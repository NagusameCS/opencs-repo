"""
Groq LLM client.
Uses the free tier of Groq's fast inference API.
"""

import time
from typing import Dict, Any, Optional
import json

from groq import AsyncGroq
from loguru import logger

from .base_client import BaseLLMClient, LLMResponse


class GroqClient(BaseLLMClient):
    """Client for Groq API - ultra-fast inference."""
    
    provider_name = "groq"
    default_model = "llama-3.1-70b-versatile"  # Free tier
    
    # Available models (free tier)
    MODELS = {
        "llama-3.1-70b-versatile": "Llama 3.1 70B - Best quality",
        "llama-3.1-8b-instant": "Llama 3.1 8B - Fastest",
        "mixtral-8x7b-32768": "Mixtral 8x7B - Good balance",
        "gemma2-9b-it": "Gemma 2 9B - Google's model",
    }
    
    def __init__(self, api_key: str, model: str = None):
        super().__init__(api_key, model)
        self.client = AsyncGroq(api_key=api_key)
    
    async def generate(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate a response from Groq."""
        start_time = time.time()
        
        try:
            messages = []
            
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            messages.append({"role": "user", "content": prompt})
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            content = response.choices[0].message.content if response.choices else ""
            tokens_used = response.usage.total_tokens if response.usage else 0
            
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
            logger.error(f"Groq generation error: {e}")
            
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
        """Generate a structured JSON response from Groq."""
        json_instruction = f"""
You must respond with ONLY a valid JSON object. No markdown, no explanation, just JSON.
Expected schema: {json.dumps(output_schema, indent=2)}
"""
        
        enhanced_system = (system_prompt or "") + json_instruction
        
        response = await self.generate(
            prompt=prompt,
            system_prompt=enhanced_system,
            temperature=temperature,
            **kwargs
        )
        
        if response.success:
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
        system_prompt = """You are an expert financial analyst. Analyze news and provide investment insights.
Be objective and analytical. Focus on facts. Respond in JSON format only."""
        
        prompt = self._create_analysis_prompt(news_content, symbols)
        
        return await self.generate_structured(
            prompt=prompt,
            output_schema={"sentiment": "string", "confidence": "number"},
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
        system_prompt = """You are a quantitative analyst making stock predictions.
Combine technical, fundamental, and sentiment analysis.
Be realistic about risks. Respond in JSON format only."""
        
        prompt = self._create_prediction_prompt(
            symbol, company_name, technical_data, news_summary, sentiment_data
        )
        
        return await self.generate_structured(
            prompt=prompt,
            output_schema={"prediction": "string", "confidence": "number"},
            system_prompt=system_prompt,
            temperature=0.3
        )
