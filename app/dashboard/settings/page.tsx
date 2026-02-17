'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Video,
  Save,
  Check,
  Zap
} from 'lucide-react'

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // User preferences
  const [settings, setSettings] = useState({
    // Profile
    displayName: '',
    email: '',
    
    // Notifications
    emailNotifications: true,
    videoCompleteNotifications: true,
    uploadNotifications: true,
    weeklyDigest: false,
    
    // Video defaults
    defaultPlatform: 'youtube',
    defaultTone: 'neutral',
    defaultLength: '10',
    defaultClipDuration: '5',
    
    // Privacy
    analyticsEnabled: true,
    shareUsageData: false,
    
    // Appearance
    darkMode: true,
  })
  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateSetting = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
            <Zap className="w-3 h-3 mr-1" />
            Pro
          </Badge>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile
              </CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={settings.displayName}
                    onChange={(e) => updateSetting('displayName', e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => updateSetting('email', e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>Control how you receive updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Video Complete Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified when videos finish rendering</p>
                </div>
                <Switch
                  checked={settings.videoCompleteNotifications}
                  onCheckedChange={(checked) => updateSetting('videoCompleteNotifications', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Upload Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified when videos are uploaded to YouTube</p>
                </div>
                <Switch
                  checked={settings.uploadNotifications}
                  onCheckedChange={(checked) => updateSetting('uploadNotifications', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Digest</p>
                  <p className="text-sm text-muted-foreground">Receive a weekly summary of your channel performance</p>
                </div>
                <Switch
                  checked={settings.weeklyDigest}
                  onCheckedChange={(checked) => updateSetting('weeklyDigest', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Video Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Video Defaults
              </CardTitle>
              <CardDescription>Default settings for new video projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultPlatform">Default Platform</Label>
                  <select
                    id="defaultPlatform"
                    value={settings.defaultPlatform}
                    onChange={(e) => updateSetting('defaultPlatform', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram Reels</option>
                    <option value="twitch">Twitch</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultTone">Default Tone</Label>
                  <select
                    id="defaultTone"
                    value={settings.defaultTone}
                    onChange={(e) => updateSetting('defaultTone', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  >
                    <option value="neutral">Neutral</option>
                    <option value="investigative">Investigative</option>
                    <option value="dramatic">Dramatic</option>
                    <option value="humorous">Humorous</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultLength">Default Video Length</Label>
                  <select
                    id="defaultLength"
                    value={settings.defaultLength}
                    onChange={(e) => updateSetting('defaultLength', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  >
                    <option value="5">5 minutes</option>
                    <option value="8">8 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="12">12 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultClipDuration">Default Clip Duration (TikTok)</Label>
                  <select
                    id="defaultClipDuration"
                    value={settings.defaultClipDuration}
                    onChange={(e) => updateSetting('defaultClipDuration', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  >
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="45">45 seconds</option>
                    <option value="60">60 seconds</option>
                    <option value="90">90 seconds</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Privacy
              </CardTitle>
              <CardDescription>Control your data and privacy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Analytics</p>
                  <p className="text-sm text-muted-foreground">Enable analytics to track video performance</p>
                </div>
                <Switch
                  checked={settings.analyticsEnabled}
                  onCheckedChange={(checked) => updateSetting('analyticsEnabled', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Share Usage Data</p>
                  <p className="text-sm text-muted-foreground">Help improve the app by sharing anonymous usage data</p>
                </div>
                <Switch
                  checked={settings.shareUsageData}
                  onCheckedChange={(checked) => updateSetting('shareUsageData', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Use dark theme throughout the app</p>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(checked) => updateSetting('darkMode', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Link href="/dashboard">
              <Button variant="outline" className="bg-transparent">
                Cancel
              </Button>
            </Link>
            <Button 
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {saving ? (
                <>Saving...</>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
