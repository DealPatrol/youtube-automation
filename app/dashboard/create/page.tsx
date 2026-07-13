'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Sparkles, Mic, Video as VideoIcon, Upload, Loader2, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type VideoFormat = 'long-form' | 'short' | 'true-crime' | 'tutorial';
type Step = 'topic' | 'script' | 'voiceover' | 'assembly' | 'complete';

interface FormData {
  topic: string;
  format: VideoFormat;
  duration: number;
  trendingAngle: string;
}

export default function VideoCreatorPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('topic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    topic: '',
    format: 'long-form',
    duration: 600,
    trendingAngle: '',
  });

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const generateScript = async () => {
    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''}`,
        },
        body: JSON.stringify({
          topic: formData.topic,
          format: formData.format,
          duration: formData.duration,
          trending_angle: formData.trendingAngle,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate script');
      }

      const data = await response.json();
      setScriptId(data.data.id);
      setStep('script');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateVoiceover = async () => {
    if (!scriptId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/voiceovers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''}`,
        },
        body: JSON.stringify({
          script_id: scriptId,
          provider: 'google-cloud',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate voiceover');
      }

      setStep('assembly');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const assembleVideo = async () => {
    if (!scriptId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/videos/assemble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''}`,
        },
        body: JSON.stringify({
          script_id: scriptId,
          provider: 'google-cloud',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assemble video');
      }

      const data = await response.json();
      setVideoId(data.data.id);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            Create Video
          </h1>
          <p className="text-muted-foreground">Generate professional videos in minutes using AI</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Indicator */}
        <div className="mb-8 flex gap-2">
          {(['topic', 'script', 'voiceover', 'assembly', 'complete'] as Step[]).map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step === s ? 'bg-primary text-white' : (['topic', 'script', 'voiceover', 'assembly', 'complete'].indexOf(s) < (['topic', 'script', 'voiceover', 'assembly', 'complete'].indexOf(step)) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground')
                }`}
              >
                {idx + 1}
              </div>
              {idx < 4 && <div className="w-8 h-1 mx-1 bg-muted" />}
            </div>
          ))}
        </div>

        {/* Content Area */}
        {step === 'topic' && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle>What do you want to create?</CardTitle>
              <CardDescription>Tell us your video topic and we&apos;ll generate a script using AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-base">
                  Video Topic
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g., Top 5 productivity hacks, How to make sourdough bread..."
                  value={formData.topic}
                  onChange={(e) => handleInputChange('topic', e.target.value)}
                  className="text-base h-12"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="format" className="text-base">
                    Video Format
                  </Label>
                  <Select value={formData.format} onValueChange={(v) => handleInputChange('format', v as VideoFormat)}>
                    <SelectTrigger id="format" className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long-form">YouTube (8-15 min)</SelectItem>
                      <SelectItem value="short">TikTok/Reels (15-60 sec)</SelectItem>
                      <SelectItem value="true-crime">Documentary Style</SelectItem>
                      <SelectItem value="tutorial">Tutorial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-base">
                    Duration
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                      className="h-12"
                    />
                    <span className="flex items-center text-muted-foreground">seconds</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="angle" className="text-base">
                  Trending Angle (Optional)
                </Label>
                <Input
                  id="angle"
                  placeholder="e.g., Viral psychology, Beginner-friendly..."
                  value={formData.trendingAngle}
                  onChange={(e) => handleInputChange('trendingAngle', e.target.value)}
                  className="text-base h-12"
                />
              </div>

              <Button
                onClick={generateScript}
                disabled={loading || !formData.topic.trim()}
                size="lg"
                className="w-full h-12 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Script with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'script' && scriptId && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle>Your AI Script</CardTitle>
              <CardDescription>Review your generated script before proceeding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-6 rounded-lg max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Your script is being generated... In a real implementation, the full script content with scenes and timing would appear here.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('topic')} className="flex-1 h-12">
                  Back
                </Button>
                <Button onClick={generateVoiceover} disabled={loading} size="lg" className="flex-1 h-12">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Generate Voiceover
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'voiceover' && scriptId && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle>Voiceover Settings</CardTitle>
              <CardDescription>Choose voice and quality settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-base">Voice Provider</Label>
                <Tabs defaultValue="google" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="google">Google Cloud (Free)</TabsTrigger>
                    <TabsTrigger value="elevenlabs">ElevenLabs (Premium)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="google" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">Natural voices, free tier available</p>
                    <Button variant="outline" className="w-full">
                      Select Google Cloud
                    </Button>
                  </TabsContent>
                  <TabsContent value="elevenlabs" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">Premium voice quality, requires API key</p>
                    <Button variant="outline" className="w-full">
                      Select ElevenLabs
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('script')} className="flex-1 h-12">
                  Back
                </Button>
                <Button onClick={assembleVideo} disabled={loading} size="lg" className="flex-1 h-12">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assembling...
                    </>
                  ) : (
                    <>
                      <VideoIcon className="w-4 h-4 mr-2" />
                      Assemble Video
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'complete' && videoId && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-green-500" />
                Video Created Successfully!
              </CardTitle>
              <CardDescription>Your video is ready for download and upload</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-8 rounded-lg text-center">
                <VideoIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="text-lg font-semibold">Your video is ready!</p>
                <p className="text-sm text-muted-foreground mt-2">Video ID: {videoId}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Button variant="outline" size="lg" className="h-12">
                  <Download className="w-4 h-4 mr-2" />
                  Download Video
                </Button>
                <Button size="lg" className="h-12">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload to YouTube
                </Button>
              </div>

              <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full h-12">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Download(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
