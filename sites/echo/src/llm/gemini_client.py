"""
Google Gemini LLM client.
Uses the free tier of Google's Gemini API.
"""

import time
from typing import Dict, Any, Optional

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from loguru import logger

from .base_client import BaseLLMClient, LLMResponse


class GeminiClient(BaseLLMClient):
    """Client for Google Gemini API."""
    
    provider_name = "gemini"
    default_model = "gemini-1.5-flash"  # Free tier model
    
    # Available models (free tier)
    MODELS = {
        "gemini-1.5-flash": "Fast, efficient for most tasks",
        "gemini-1.5-pro": "More capable, slower",
        "gemini-pro": "Legacy model",
    }
    
    def __init__(self, api_key: str, model: str = None):
        super().__init__(api_key, model)
        genai.configure(api_key=api_key)
        
        # Safety settings - allow financial discussion
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        
        self._init_model()
    
    def _init_model(self):
        """Initialize the Gemini model."""
        self.gen_model = genai.GenerativeModel(
            model_name=self.model,
            safety_settings=self.safety_settings
        )
    
    async def generate(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate a response from Gemini."""
        start_time = time.time()
        
        try:
            # Combine system prompt with user prompt
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            # Generation config
            generation_config = genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
            
            # Generate response
            response = self.gen_model.generate_content(
                full_prompt,
                generation_config=generation_config
            )
            
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # Extract content
            content = response.text if response.text else ""
            
            # Try to get token count
            tokens_used = 0
            if hasattr(response, 'usage_metadata'):
                tokens_used = getattr(response.usage_metadata, 'total_token_count', 0)
            
            return LLMResponse(
                provider=self.provider_name,
                model=self.model,
                content=content,
                tokens_used=tokens_used,
                response_time_ms=elapsed_ms,
                raw_response=response
            )
            
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Gemini generation error: {e}")
            
            return LLMResponse(
                provider=self.provider_name,
                model=self.model,
                content="",
                response_time_ms=elapsed_ms,
                error=str(e)
            )
    
    async def generate_structured(
        self,
        prompt: str,
        output_schema: Dict[str, Any],
        system_prompt: str = None,
        temperature: float = 0.3,
        **kwargs
    ) -> LLMResponse:
        """Generate a structured JSON response from Gemini."""
        import json
        
        # Add JSON instruction to prompt
        json_instruction = f"""
You must respond with ONLY a valid JSON object matching this schema:
{json.dumps(output_schema, indent=2)}

Do not include any text before or after the JSON. Do not use markdown code blocks.
Respond with ONLY the JSON object.
"""
        
        enhanced_prompt = f"{prompt}\n\n{json_instruction}"
        
        response = await self.generate(
            prompt=enhanced_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            **kwargs
        )
        
        if response.success:
            # Parse JSON from response
            parsed = self.parse_json_response(response.content)
            if parsed:
                response.structured_data = parsed
            else:
                response.error = "Failed to parse JSON response"
        
        return response
    
    async def analyze_news(
        self,
        news_content: str,
        symbols: list = None
    ) -> LLMResponse:
        """Analyze news content for investment insights."""
        system_prompt = """You are an expert financial analyst specializing in market news analysis.
Your task is to analyze news articles and extract actionable investment insights.
Be objective, analytical, and focus on facts rather than speculation.
Always provide your analysis in valid JSON format."""
        
        prompt = self._create_analysis_prompt(news_content, symbols)
        
        return await self.generate_structured(
            prompt=prompt,
            output_schema={
                "sentiment": "string",
                "sentiment_score": "number",
                "key_insights": "array",
                "affected_symbols": "array",
                "confidence": "number",
                "recommended_action": "string",
                "reasoning": "string"
            },
            system_prompt=system_prompt,
            temperature=0.3
        )
    
    async def make_prediction(
        self,
        symbol: str,
        company_name: str,
        technical_data: Dict[str, Any],
        news_summary: str,
        sentiment_data: Dict[str, Any]
    ) -> LLMResponse:
        """Generate a stock prediction."""
        system_prompt = """You are a world-class quantitative analyst and portfolio manager.
You combine technical analysis, fundamental analysis, and sentiment analysis to make investment decisions.
You are known for your rigorous analytical approach and realistic risk assessment.
Your predictions include clear entry points, exit points, and risk management strategies.
Always respond with valid JSON."""
        
        prompt = self._create_prediction_prompt(
            symbol, company_name, technical_data, news_summary, sentiment_data
        )
        
        return await self.generate_structured(
            prompt=prompt,
            output_schema={
                "symbol": "string",
                "prediction": "string",
                "confidence": "number",
                "target_price": "number",
                "expected_return_percent": "number",
                "time_horizon_days": "number",
                "reasoning": "string"
            },
            system_prompt=system_prompt,
            temperature=0.3
        )
