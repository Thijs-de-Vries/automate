import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { 
  Send, 
  Loader2, 
  Settings, 
  Trophy, 
  TrendingUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { Id } from '../../../convex/_generated/dataModel';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'suggestion';
  content: string;
  timestamp: number;
  data?: {
    suggestionId?: Id<'dotaProfileSuggestions'>;
    reasoning?: string;
    type?: string;
  };
}

interface HeroPoolEntry {
  heroId: number;
  heroName: string;
  proficiency: string;
  notes?: string;
}

interface ProfileSuggestion {
  _id: Id<'dotaProfileSuggestions'>;
  suggestion: string;
  reasoning: string;
  suggestionType: string;
}

interface DotaMatch {
  _id: Id<'dotaMatches'>;
  matchId: string;
  heroName: string;
  won: boolean;
  isAnalyzed: boolean;
}

interface PlayerProfile {
  steamAccountId?: string;
  heroPool: HeroPoolEntry[];
  playstyle?: string;
  strengths: string[];
  weaknesses: string[];
  preferredRoles: string[];
}

export default function DotaCoachApp() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [steamId, setSteamId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const playerId = user?.id || '';
  
  // Queries - temporarily use 'as any' until Convex regenerates types
  const profile = useQuery((api as any).dota?.getPlayerProfile, { playerId }) as PlayerProfile | undefined;
  const recentMatches = useQuery((api as any).dota?.getRecentMatches, { playerId, limit: 10 }) as DotaMatch[] | undefined;
  const suggestions = useQuery((api as any).dota?.getPendingProfileSuggestions, { playerId }) as ProfileSuggestion[] | undefined;
  const unanalyzedMatches = useQuery((api as any).dota?.getAllUnanalyzedMatches, { playerId }) as DotaMatch[] | undefined;
  
  // Mutations & Actions - temporarily use 'as any' until Convex regenerates types
  const upsertProfile = useMutation((api as any).dota?.upsertPlayerProfile);
  const syncMatches = useAction((api as any).dota?.syncPlayerMatches);
  const analyzeMatch = useAction((api as any).dotaAnalysis?.analyzeMatch);
  const chatWithCoach = useAction((api as any).dotaAnalysis?.chatWithCoach);
  const resolveSuggestion = useMutation((api as any).dota?.resolveProfileSuggestion);
  const clearChatHistory = useMutation((api as any).dota?.clearChatHistory);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Steam ID from profile
  useEffect(() => {
    if (profile?.steamAccountId) {
      setSteamId(profile.steamAccountId);
    }
  }, [profile]);

  // Show pending suggestions as messages
  useEffect(() => {
    if (suggestions && suggestions.length > 0) {
      const newSuggestions = suggestions.filter(
        (s: ProfileSuggestion) => !messages.some((m) => m.data?.suggestionId === s._id)
      );
      
      newSuggestions.forEach((suggestion: ProfileSuggestion) => {
        addMessage({
          type: 'suggestion',
          content: suggestion.suggestion,
          data: {
            suggestionId: suggestion._id,
            reasoning: suggestion.reasoning,
            type: suggestion.suggestionType,
          },
        });
      });
    }
  }, [suggestions]);

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: `${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleSaveSteamId = async () => {
    if (!steamId.trim()) return;
    
    await upsertProfile({
      playerId,
      steamAccountId: steamId.trim(),
    });
    
    addMessage({
      type: 'system',
      content: `Steam ID saved: ${steamId}. You can now sync your matches!`,
    });
    
    setShowSettings(false);
  };

  const handleSyncMatches = async () => {
    if (!profile?.steamAccountId) {
      addMessage({
        type: 'system',
        content: 'Please configure your Steam ID in settings first.',
      });
      return;
    }

    setIsAnalyzing(true);
    addMessage({
      type: 'system',
      content: 'Syncing your recent matches...',
    });

    try {
      const result = await syncMatches({
        playerId,
        accountId: profile.steamAccountId,
        limit: 20,
      });
      
      addMessage({
        type: 'system',
        content: `Synced ${result.syncedCount} of ${result.total} matches successfully!`,
      });
    } catch (error) {
      addMessage({
        type: 'system',
        content: `Error syncing matches: ${error}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeCommand = async (matchId: string) => {
    if (!profile?.steamAccountId) {
      addMessage({
        type: 'system',
        content: 'Please configure your Steam ID in settings first.',
      });
      return;
    }

    setIsAnalyzing(true);
    addMessage({
      type: 'system',
      content: `Analyzing match ${matchId}...`,
    });

    try {
      const result = await analyzeMatch({
        matchId,
        playerId,
        accountId: profile.steamAccountId,
      });

      if (result.success && result.analysis) {
        const analysis = result.analysis;
        
        // Send phase-by-phase analysis
        addMessage({
          type: 'assistant',
          content: `## 📋 Match ${matchId} - Draft Analysis\n\n${analysis.draft}`,
        });
        
        addMessage({
          type: 'assistant',
          content: `## 🌅 Early Game (0-15 min)\n\n${analysis.earlyGame}`,
        });
        
        addMessage({
          type: 'assistant',
          content: `## ⚔️ Mid Game (15-30 min)\n\n${analysis.midGame}`,
        });
        
        addMessage({
          type: 'assistant',
          content: `## 🏆 Late Game (30+ min)\n\n${analysis.lateGame}`,
        });
        
        addMessage({
          type: 'assistant',
          content: `## 📊 Overall Summary\n\n${analysis.overall}`,
        });

        if (result.hasSuggestions) {
          addMessage({
            type: 'system',
            content: 'I noticed some patterns worth adding to your profile. Check the suggestions below!',
          });
        }
        
        return true; // Success
      }
      return false;
    } catch (error: any) {
      addMessage({
        type: 'system',
        content: `Error analyzing match ${matchId}: ${error.message || error}`,
      });
      return false;
    }
  };

  const handleAnalyzeAll = async () => {
    if (!profile?.steamAccountId) {
      addMessage({
        type: 'system',
        content: 'Please configure your Steam ID in settings first.',
      });
      return;
    }

    if (!unanalyzedMatches || unanalyzedMatches.length === 0) {
      addMessage({
        type: 'system',
        content: 'No unanalyzed matches found. Use `/sync` to fetch new matches!',
      });
      return;
    }

    setIsAnalyzing(true);
    addMessage({
      type: 'system',
      content: `Found ${unanalyzedMatches.length} unanalyzed matches. Analyzing in chronological order (oldest first)...`,
    });

    let successCount = 0;
    for (const match of unanalyzedMatches) {
      addMessage({
        type: 'system',
        content: `📍 Analyzing match ${match.matchId} (${match.heroName})...`,
      });

      try {
        const result = await analyzeMatch({
          matchId: match.matchId,
          playerId,
          accountId: profile.steamAccountId,
        });

        if (result.success && result.analysis) {
          const analysis = result.analysis;
          
          addMessage({
            type: 'assistant',
            content: `## 📋 Match ${match.matchId} (${match.heroName}) - ${match.won ? '✅ Win' : '❌ Loss'}\n\n**Draft:** ${analysis.draft}\n\n**Early Game:** ${analysis.earlyGame}\n\n**Mid Game:** ${analysis.midGame}\n\n**Late Game:** ${analysis.lateGame}\n\n**Overall:** ${analysis.overall}`,
          });
          successCount++;
        }
      } catch (error: any) {
        addMessage({
          type: 'system',
          content: `⚠️ Error analyzing match ${match.matchId}: ${error.message || error}`,
        });
      }
      
      // Small delay between matches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    addMessage({
      type: 'system',
      content: `✅ Completed! Successfully analyzed ${successCount} of ${unanalyzedMatches.length} matches.`,
    });
    
    setIsAnalyzing(false);
  };

  const handleChatMessage = async (message: string) => {
    setIsAnalyzing(true);

    try {
      const result = await chatWithCoach({
        playerId,
        message,
      });

      addMessage({
        type: 'assistant',
        content: result.message,
      });

      if (result.hasSuggestion) {
        addMessage({
          type: 'system',
          content: 'I have a suggestion to update your profile based on this conversation!',
        });
      }
    } catch (error: any) {
      addMessage({
        type: 'system',
        content: `Error: ${error.message || error}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isAnalyzing) return;

    const message = inputValue.trim();
    setInputValue('');

    // Add user message
    addMessage({
      type: 'user',
      content: message,
    });

    // Check for commands
    if (message === '/analyze') {
      // Analyze all unanalyzed matches
      await handleAnalyzeAll();
    } else if (message.startsWith('/analyze ')) {
      const matchId = message.replace('/analyze ', '').trim();
      await handleAnalyzeCommand(matchId);
      setIsAnalyzing(false);
    } else if (message === '/sync') {
      await handleSyncMatches();
    } else if (message === '/profile') {
      const profileText = profile
        ? `## Your Profile\n\n**Hero Pool:** ${profile.heroPool.map((h: HeroPoolEntry) => h.heroName).join(', ') || 'None'}\n\n**Playstyle:** ${profile.playstyle || 'Not set'}\n\n**Strengths:** ${profile.strengths.join(', ') || 'None'}\n\n**Weaknesses:** ${profile.weaknesses.join(', ') || 'None'}\n\n**Preferred Roles:** ${profile.preferredRoles.join(', ') || 'None'}`
        : 'No profile data yet. Tell me about your playstyle and hero pool!';
      
      addMessage({
        type: 'assistant',
        content: profileText,
      });
    } else if (message === '/recent') {
      if (recentMatches && recentMatches.length > 0) {
        const matchList = recentMatches
          .slice(0, 5)
          .map((m: DotaMatch) => `- Match ${m.matchId}: ${m.heroName} - ${m.won ? 'Won' : 'Lost'} ${m.isAnalyzed ? '✅' : '⏳'}`)
          .join('\n');
        
        const unanalyzedCount = unanalyzedMatches?.length || 0;
        const statusLine = unanalyzedCount > 0 
          ? `\n\n**${unanalyzedCount} matches waiting for analysis.** Use \`/analyze\` to analyze all!`
          : '\n\nAll matches analyzed! ✅';
        
        addMessage({
          type: 'assistant',
          content: `## Recent Matches\n\n${matchList}${statusLine}`,
        });
      } else {
        addMessage({
          type: 'assistant',
          content: 'No recent matches found. Use `/sync` to fetch your matches from OpenDota!',
        });
      }
    } else if (message === '/clear') {
      // Clear chat history
      await clearChatHistory({ playerId });
      setMessages([]);
      addMessage({
        type: 'system',
        content: '🧹 Chat history cleared! The coach will start fresh.',
      });
    } else {
      // Regular chat
      await handleChatMessage(message);
    }
  };

  const handleSuggestionResponse = async (suggestionId: Id<'dotaProfileSuggestions'>, accept: boolean) => {
    await resolveSuggestion({ suggestionId, accept });
    
    addMessage({
      type: 'system',
      content: accept 
        ? '✅ Profile updated successfully!' 
        : '❌ Suggestion dismissed.',
    });
  };

  if (showSettings) {
    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Dota Coach Settings</h2>
          <Button variant="secondary" onClick={() => setShowSettings(false)}>
            Back
          </Button>
        </div>

        <Card className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Steam Account ID (Steam32)
            </label>
            <Input
              type="text"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="e.g., 123456789"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Find your Steam32 ID on OpenDota or SteamID.io
            </p>
          </div>
          
          <Button onClick={handleSaveSteamId} disabled={!steamId.trim()}>
            Save Steam ID
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
               style={{ backgroundColor: 'var(--primary-muted)' }}>
            <Trophy className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Dota Coach</h2>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              AI-powered match analysis with RAG
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setShowSettings(true)}>
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Welcome Card */}
      {messages.length === 0 && (
        <Card className="p-6 mb-4">
          <h3 className="font-semibold mb-2">Welcome to Dota Coach! 🎮</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Get AI-powered coaching with match analysis and personalized improvement tips.
          </p>
          
          <div className="space-y-2 text-sm">
            <p className="font-medium">Available Commands:</p>
            <ul className="space-y-1" style={{ color: 'var(--muted-foreground)' }}>
              <li><code>/sync</code> - Sync your recent ranked matches from OpenDota</li>
              <li><code>/recent</code> - View your recent matches</li>
              <li><code>/analyze</code> - Analyze all unanalyzed matches (oldest first)</li>
              <li><code>/analyze &lt;match_id&gt;</code> - Analyze a specific match</li>
              <li><code>/profile</code> - View your player profile</li>
              <li><code>/clear</code> - Clear chat history and start fresh</li>
            </ul>
            <p className="mt-3">
              Or just chat with me about your playstyle, hero pool, and strategies!
            </p>
          </div>
        </Card>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map((message) => (
          <div key={message.id}>
            {message.type === 'user' && (
              <div className="flex justify-end">
                <Card className="max-w-[80%] p-4" style={{ backgroundColor: 'var(--primary-muted)' }}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </Card>
              </div>
            )}
            
            {message.type === 'assistant' && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                     style={{ backgroundColor: 'var(--primary)' }}>
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <Card className="flex-1 p-4">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: message.content.replace(/\n/g, '<br/>').replace(/##\s+(.+)/g, '<h3>$1</h3>')
                    }}
                  />
                </Card>
              </div>
            )}
            
            {message.type === 'system' && (
              <div className="flex justify-center">
                <div className="text-sm px-4 py-2 rounded-full" 
                     style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  {message.content}
                </div>
              </div>
            )}
            
            {message.type === 'suggestion' && (
              <Card className="p-4 border-2" style={{ borderColor: 'var(--primary)' }}>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 shrink-0" style={{ color: 'var(--primary)' }} />
                  <div className="flex-1">
                    <p className="font-medium mb-1">Profile Update Suggestion</p>
                    <p className="text-sm mb-2">{message.content}</p>
                    {message.data?.reasoning && (
                      <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
                        Reason: {message.data.reasoning}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => message.data?.suggestionId && handleSuggestionResponse(message.data.suggestionId, true)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => message.data?.suggestionId && handleSuggestionResponse(message.data.suggestionId, false)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ))}
        
        {isAnalyzing && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                 style={{ backgroundColor: 'var(--primary)' }}>
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <Card className="flex-1 p-4">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Analyzing...
              </p>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message or use /commands..."
          disabled={isAnalyzing}
          className="flex-1"
        />
        <Button type="submit" disabled={!inputValue.trim() || isAnalyzing}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
