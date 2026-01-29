#!/usr/bin/env python3
"""
Optimized FFmpeg Video Rendering
Uses FFmpeg concat demuxer for efficient video composition
"""

import subprocess
import os
import tempfile
from pathlib import Path
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class FFmpegRenderer:
    """Optimized FFmpeg-based video renderer"""

    def __init__(self, fps: int = 24, pix_fmt: str = "yuv420p"):
        self.fps = fps
        self.pix_fmt = pix_fmt

    def render_video(
        self,
        images: List[str],
        voice_path: str,
        music_path: Optional[str],
        output_path: str,
        image_duration: int = 2,
        voice_volume: float = 1.0,
        music_volume: float = 0.2,
    ) -> str:
        """
        Render video from images and audio using FFmpeg concat demuxer

        Args:
            images: List of image file paths
            voice_path: Path to voiceover audio file
            music_path: Path to background music file (optional)
            output_path: Output video file path
            image_duration: Duration each image displays (seconds)
            voice_volume: Voiceover volume (0-1)
            music_volume: Background music volume (0-1)

        Returns:
            Path to output video
        """
        if not images:
            raise ValueError("No images provided")

        if not os.path.exists(voice_path):
            raise FileNotFoundError(f"Voice file not found: {voice_path}")

        # Create temporary concat file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            concat_file = f.name
            for img in images:
                if not os.path.exists(img):
                    logger.warning(f"Image not found, skipping: {img}")
                    continue
                f.write(f"file '{img}'\n")
                f.write(f"duration {image_duration}\n")

        try:
            # Build FFmpeg command
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file,
                "-i", voice_path,
            ]

            # Add music if provided
            if music_path and os.path.exists(music_path):
                cmd.extend(["-i", music_path])

            # Audio filter: mix voice and music
            if music_path and os.path.exists(music_path):
                audio_filter = (
                    f"[1:a]volume={voice_volume}[a1];"
                    f"[2:a]volume={music_volume}[a2];"
                    f"[a1][a2]amix=inputs=2[a]"
                )
                cmd.extend(["-filter_complex", audio_filter])
                cmd.extend(["-map", "0:v", "-map", "[a]"])
            else:
                # Just use voiceover
                cmd.extend(["-map", "0:v", "-map", "1:a"])

            # Video settings
            cmd.extend([
                "-pix_fmt", self.pix_fmt,
                "-r", str(self.fps),
                "-c:v", "libx264",
                "-preset", "medium",  # faster rendering
                "-c:a", "aac",
                output_path,
            ])

            logger.info(f"Running FFmpeg: {' '.join(cmd)}")
            subprocess.run(cmd, check=True, capture_output=True)

            if not os.path.exists(output_path):
                raise RuntimeError("FFmpeg failed to create output file")

            logger.info(f"Video rendered successfully: {output_path}")
            return output_path

        finally:
            # Cleanup concat file
            if os.path.exists(concat_file):
                os.remove(concat_file)

    def render_with_captions(
        self,
        images: List[str],
        voice_path: str,
        music_path: Optional[str],
        captions: dict,
        output_path: str,
        image_duration: int = 2,
    ) -> str:
        """
        Render video with subtitle overlay

        Args:
            images: List of image file paths
            voice_path: Path to voiceover audio file
            music_path: Path to background music file
            captions: Dict with subtitle data {start_time: text, ...}
            output_path: Output video file path
            image_duration: Duration each image displays

        Returns:
            Path to output video
        """
        # First render base video
        base_video = output_path.replace(".mp4", "_base.mp4")
        self.render_video(
            images=images,
            voice_path=voice_path,
            music_path=music_path,
            output_path=base_video,
            image_duration=image_duration,
        )

        # Add subtitles if provided
        if captions:
            return self._add_subtitles(base_video, captions, output_path)

        return base_video

    def _add_subtitles(self, video_path: str, captions: dict, output_path: str) -> str:
        """Add SRT subtitles to video"""
        # Create SRT file from captions
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            srt_file = f.name
            for idx, (timestamp, text) in enumerate(captions.items(), 1):
                f.write(f"{idx}\n")
                f.write(f"{timestamp} --> {timestamp}\n")
                f.write(f"{text}\n\n")

        try:
            cmd = [
                "ffmpeg",
                "-i", video_path,
                "-vf", f"subtitles={srt_file}",
                "-c:v", "libx264",
                "-preset", "fast",
                output_path,
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return output_path
        finally:
            if os.path.exists(srt_file):
                os.remove(srt_file)
