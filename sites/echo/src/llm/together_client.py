"""
Together AI client.
Uses free tier of Together AI for open source models.
"""

import time
from typing import Dict, Any, Optional
import json

import httpx
from loguru import logger

from .base_client import BaseLLMClient, LLMResponse


class TogetherClient(BaseLLMClient):
    """Client for Together AI API - open source models."""
    
    provider_name = "together"
    default_model = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"
    base_url = "https://api.together.xyz/v1"
    
    # Available models
    MODELS = {
        "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": "Llama 3.1 70B Turbo",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": "Llama 3.1 8B Turbo",
        "mistralai/Mixtral-8x7B-Instruct-v0.1": "Mixtral 8x7B",
        "Qwen/Qwen2-72B-Instruct": "Qwen2 72B",
        "databricks/dbrx-instruct": "DBRX Instruct",
    }
    
    def __init__(self, api_key: str, model: str = None):
        super().__init__(api_key, model)
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def generate(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate a response from Together AI."""
        start_time = time.time()
        
        try:
            messages = []
            
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
            
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            content = data["choices"][0]["message"]["content"] if data.get("choices") else ""
            tokens_used = data.get("usage", {}).get("total_tokens", 0)
            
            return LLMResponse(
                provider=self.provider_name,
                model=self.model,
                content=content,
                tokens_used=tokens_used,
                response_time_ms=elapsed_ms,
                raw_response=data
            )
            
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Together AI generation error: {e}")
            
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
        """Generate a structured JSON response."""
        json_instruction = f"""
Respond with ONLY valid JSON matching this schema:
{json.dumps(output_schema, indent=2)}
No markdown, no explanation, just the JSON object.
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
Be objective and analytical. Respond in JSON format only."""
        
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
        system_prompt = """You are a quantitative analyst. Make stock predictions based on data.
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
