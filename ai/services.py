"""
Text-to-Speech Service
Generates voiceovers using ElevenLabs or OpenAI
"""

import os
import requests
import json
from typing import Optional
from pathlib import Path

class TTSService:
    """Handles text-to-speech generation"""
    
    def __init__(self, provider: str = "elevenlabs"):
        self.provider = provider
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
        self.openai_key = os.getenv("OPENAI_API_KEY", "")
        self.storage_path = os.getenv("STORAGE_PATH", "/app/storage")
        
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
    
    def generate_elevenlabs_speech(self, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> Optional[str]:
        """
        Generate speech using ElevenLabs API
        voice_id options:
        - 21m00Tcm4TlvDq8ikWAM: Rachel (female, warm)
        - EXAVITQu4vr4xnSDxMaL: Bella (female, professional)
        - pFZP5JQG7iQjIQuC4Iy3: Adam (male, professional)
        - VR6AewLrD7X1z75XrXQD: Antoni (male, casual)
        """
        if not self.elevenlabs_key:
            print("[TTS] ElevenLabs API key not configured")
            return None
        
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            headers = {
                "xi-api-key": self.elevenlabs_key,
                "Content-Type": "application/json",
            }
            
            payload = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                }
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code != 200:
                print(f"[TTS] ElevenLabs error: {response.text}")
                return None
            
            # Save audio file
            audio_path = f"{self.storage_path}/voiceover_{hash(text) % 10000}.mp3"
            with open(audio_path, 'wb') as f:
                f.write(response.content)
            
            print(f"[TTS] Generated speech: {audio_path}")
            return audio_path
        
        except Exception as e:
            print(f"[TTS] Error generating speech: {e}")
            return None
    
    def generate_openai_speech(self, text: str, voice: str = "nova") -> Optional[str]:
        """
        Generate speech using OpenAI Text-to-Speech API
        voice options: alloy, echo, fable, onyx, nova, shimmer
        """
        if not self.openai_key:
            print("[TTS] OpenAI API key not configured")
            return None
        
        try:
            import openai
            openai.api_key = self.openai_key
            
            response = openai.Audio.create(
                model="tts-1-hd",
                voice=voice,
                input=text,
                speed=1.0,
            )
            
            # Save audio file
            audio_path = f"{self.storage_path}/voiceover_{hash(text) % 10000}.mp3"
            response.stream_to_file(audio_path)
            
            print(f"[TTS] Generated speech: {audio_path}")
            return audio_path
        
        except Exception as e:
            print(f"[TTS] Error generating speech: {e}")
            return None
    
    def generate_voiceover_from_script(self, script_sections: list, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> Optional[str]:
        """
        Generate complete voiceover from script sections
        """
        try:
            # Combine all script text
            full_text = " ".join([section.get("text", "") for section in script_sections])
            
            # Generate speech
            if self.provider == "elevenlabs":
                audio_path = self.generate_elevenlabs_speech(full_text, voice_id)
            else:
                audio_path = self.generate_openai_speech(full_text)
            
            return audio_path
        
        except Exception as e:
            print(f"[TTS] Error generating voiceover: {e}")
            return None


class ImageGenService:
    """Generates images using DALL-E or other AI image generators"""
    
    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY", "")
        self.storage_path = os.getenv("STORAGE_PATH", "/app/storage")
        
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
    
    def generate_with_dall_e(self, prompt: str, size: str = "1024x1792") -> Optional[str]:
        """
        Generate image using DALL-E 3
        size options: 1024x1024, 1024x1792 (portrait), 1792x1024 (landscape)
        """
        if not self.openai_key:
            print("[ImageGen] OpenAI API key not configured")
            return None
        
        try:
            import openai
            openai.api_key = self.openai_key
            
            response = openai.Image.create(
                model="dall-e-3",
                prompt=prompt,
                size=size,
                quality="hd",
                n=1,
            )
            
            image_url = response.data[0].url
            
            # Download image
            img_response = requests.get(image_url, timeout=30)
            if img_response.status_code == 200:
                image_path = f"{self.storage_path}/generated_image_{hash(prompt) % 10000}.png"
                with open(image_path, 'wb') as f:
                    f.write(img_response.content)
                
                print(f"[ImageGen] Generated image: {image_path}")
                return image_path
        
        except Exception as e:
            print(f"[ImageGen] Error generating image: {e}")
        
        return None
    
    def generate_scene_image(self, scene_description: str, style: str = "cinematic") -> Optional[str]:
        """Generate AI image for a scene"""
        prompt = f"{style} style: {scene_description}"
        return self.generate_with_dall_e(prompt, size="1024x1792")


class SubtitleService:
    """Generates subtitles using Whisper or other services"""
    
    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY", "")
        self.storage_path = os.getenv("STORAGE_PATH", "/app/storage")
    
    def generate_subtitles_from_audio(self, audio_path: str, language: str = "en") -> Optional[str]:
        """
        Generate subtitles from audio using Whisper
        Returns VTT subtitle file path
        """
        if not self.openai_key:
            print("[Subtitles] OpenAI API key not configured")
            return None
        
        try:
            import openai
            openai.api_key = self.openai_key
            
            # Transcribe audio
            with open(audio_path, "rb") as audio_file:
                transcript = openai.Audio.transcribe(
                    model="whisper-1",
                    file=audio_file,
                    language=language,
                )
            
            # Format as VTT
            vtt_content = "WEBVTT\n\n"
            
            # Simple subtitle generation (could be enhanced with timing)
            words = transcript.get("text", "").split()
            words_per_subtitle = 10
            
            for i in range(0, len(words), words_per_subtitle):
                start_time = self.format_timestamp(i * 1.5)  # Estimate timing
                end_time = self.format_timestamp((i + words_per_subtitle) * 1.5)
                text = " ".join(words[i:i+words_per_subtitle])
                
                vtt_content += f"{start_time} --> {end_time}\n{text}\n\n"
            
            # Save VTT file
            vtt_path = f"{self.storage_path}/subtitles_{hash(audio_path) % 10000}.vtt"
            with open(vtt_path, 'w') as f:
                f.write(vtt_content)
            
            print(f"[Subtitles] Generated subtitles: {vtt_path}")
            return vtt_path
        
        except Exception as e:
            print(f"[Subtitles] Error generating subtitles: {e}")
            return None
    
    @staticmethod
    def format_timestamp(seconds: float) -> str:
        """Convert seconds to VTT timestamp format (HH:MM:SS.mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


# ============ USAGE EXAMPLE ============
if __name__ == "__main__":
    # TTS
    tts = TTSService(provider="elevenlabs")
    voiceover = tts.generate_elevenlabs_speech(
        "This is a test of the text to speech system"
    )
    print(f"Voiceover: {voiceover}")
    
    # Image Generation
    img_gen = ImageGenService()
    image = img_gen.generate_scene_image(
        "A futuristic city skyline at sunset with flying cars"
    )
    print(f"Generated image: {image}")
    
    # Subtitles
    subtitles = SubtitleService()
    subs = subtitles.generate_subtitles_from_audio("/path/to/audio.mp3")
    print(f"Subtitles: {subs}")
