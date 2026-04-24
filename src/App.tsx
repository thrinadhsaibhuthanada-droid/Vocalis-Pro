import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  Square, 
  Copy, 
  Trash2, 
  Check, 
  Sparkles,
  RefreshCcw,
  BookOpen,
  History,
  Activity,
  Search,
  Undo2,
  Play,
  Pause,
  RotateCcw,
  Settings,
  ChevronRight,
  Share2,
  Download,
  SkipForward,
  SkipBack,
  Globe,
  SlidersHorizontal,
  Volume2,
  Palette,
  Type,
  Activity as ActivityIcon,
  Languages
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useAudioRecorder, blobToBase64 } from '@/src/lib/audioRecorder';
import { transcribeAudio, TranscriptionOptions } from '@/src/lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function VocalisLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <div className="absolute inset-0 bg-black/5 blur-xl rounded-full" />
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10">
        <path d="M50 10C50 10 50 40 20 40C20 40 10 40 10 50C10 60 20 60 20 60C50 60 50 90 50 90C50 90 50 60 80 60C80 60 90 60 90 50C90 40 80 40 80 40C50 40 50 10 50 10Z" fill="currentColor" className="opacity-100" />
        <circle cx="50" cy="50" r="8" fill="white" />
      </svg>
    </div>
  );
}

function Waveform({ 
  analyser, 
  isRecording, 
  sensitivity = 1, 
  color = 'black',
  style = 'smooth',
  className = ""
}: { 
  analyser: AnalyserNode | null, 
  isRecording: boolean,
  sensitivity?: number,
  color?: string,
  style?: 'smooth' | 'sharp' | 'blocks',
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const isActuallyRecording = isRecording && analyser;
    
    // For preview mode, we might want to simulate some data if not recording
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      const bufferLength = analyser ? analyser.frequencyBinCount : 64;
      const dataArray = new Uint8Array(bufferLength);
      
      if (analyser && isRecording) {
        analyser.getByteFrequencyData(dataArray);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = style === 'blocks' ? 8 : style === 'sharp' ? 2 : 4;
      const barPadding = style === 'blocks' ? 4 : 2;
      const totalBarWidth = barWidth + barPadding;
      const numberOfBars = Math.floor(canvas.width / totalBarWidth);
      
      const centerY = canvas.height / 2;

      for (let i = 0; i < numberOfBars; i++) {
        const sampleIndex = Math.floor((i / numberOfBars) * bufferLength * 0.4);
        const freqValue = isActuallyRecording ? dataArray[sampleIndex] : 0;
        
        let barHeight = (freqValue / 255) * canvas.height * 0.8 * (sensitivity || 1);
        if (isActuallyRecording) barHeight += 4;
        else barHeight = 2; // Flat baseline
        
        const x = i * totalBarWidth;
        
        const opacity = isActuallyRecording ? (0.2 + (freqValue / 255) * 0.8) : 0.1;
        
        if (color === 'rainbow') {
          const hue = (i / numberOfBars) * 360;
          ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${opacity})`;
        } else if (color === 'red') {
          ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
        } else if (color === 'blue') {
          ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;
        } else if (color === 'emerald') {
          ctx.fillStyle = `rgba(16, 185, 129, ${opacity})`;
        } else if (color === 'purple') {
          ctx.fillStyle = `rgba(139, 92, 246, ${opacity})`;
        } else {
          ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        }
        
        ctx.beginPath();
        const borderRadius = style === 'sharp' ? 0 : style === 'blocks' ? 4 : 2;
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, borderRadius);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isRecording, analyser, sensitivity, color, style]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={100} 
      className={`transition-opacity duration-700 ${className}`}
    />
  );
}

export default function App() {
  const { 
    isRecording, 
    audioBlob, 
    recordingTime, 
    analyser,
    startRecording, 
    stopRecording, 
    clearAudio 
  } = useAudioRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'settings' | 'history'>('live');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualCardRef = useRef<HTMLDivElement>(null);
  
  const [options, setOptions] = useState<TranscriptionOptions>({
    mappings: '',
    tone: 'default',
    format: 'adaptive',
    translateTo: '',
    inputLanguage: 'auto',
    waveformSensitivity: 1,
    waveformColor: 'black',
    waveformStyle: 'smooth',
    searchHighlightColor: 'yellow',
    enableTTS: true,
    ttsVoice: '',
    ttsRate: 1,
    fontSize: 16,
    fontFamily: 'serif'
  });

  React.useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      
      const targetLangs = ['en', 'hi', 'te', 'es', 'fr', 'de', 'ja', 'zh'];
      let selection: SpeechSynthesisVoice[] = [];
      
      targetLangs.forEach(langCode => {
        const langVoices = availableVoices.filter(v => 
          v.lang.toLowerCase().startsWith(langCode) || 
          (langCode === 'te' && v.lang.toLowerCase().includes('telugu')) ||
          (langCode === 'hi' && v.lang.toLowerCase().includes('hindi')) ||
          (langCode === 'zh' && (v.lang.toLowerCase().includes('chinese') || v.lang.toLowerCase().includes('mandarin')))
        );
        
        // Sort by "quality" markers and specific preferred voices
        const sorted = langVoices.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          
          const getScore = (voice: SpeechSynthesisVoice) => {
            const name = voice.name.toLowerCase();
            let score = 0;
            
            // Premium/Natural markers
            if (name.includes('natural')) score += 20;
            if (name.includes('google')) score += 15;
            if (name.includes('premium')) score += 10;
            if (name.includes('enhanced')) score += 10;
            
            // Specific high-quality voice names
            const preferredNames = [
              'google us english',
              'google uk english',
              'samantha',
              'daniel',
              'google \u0939\u093f\u0928\u094d\u0926\u0940', // Google Hindi
              'google \u0c24\u0c46\u0c32\u0c41\u0c17\u0c41', // Google Telugu
              'microsoft \u0939\u093f\u0928\u094d\u0926\u0940',
              'microsoft \u0c24\u0c46\u0c32\u0c41\u0c17\u0c41'
            ];
            
            if (preferredNames.some(p => name.includes(p))) score += 50;
            
            // Prefer local voices for stability
            if (!voice.localService) score -= 5;
            
            return score;
          };
          
          return getScore(b) - getScore(a);
        });
        
        // Take top quality voices for each language
        selection = [...selection, ...sorted.slice(0, 3)];
      });

      // Filter for unique voices and limit to a curated set of around 5-6
      const seen = new Set();
      const finalVoices = selection.filter(v => {
        const duplicate = seen.has(v.name);
        seen.add(v.name);
        return !duplicate;
      }).slice(0, 6);

      setVoices(finalVoices);
      
      if (finalVoices.length > 0 && !options.ttsVoice) {
        // Try to find a good default (prefer English Natural/Google)
        const defaultVoice = finalVoices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))) || finalVoices[0];
        setOptions(prev => ({ ...prev, ttsVoice: defaultVoice.name }));
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [options.ttsVoice]);

  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);

  const detectLanguage = (text: string) => {
    // Priority hints from options
    if (options.translateTo === 'Hindi' || (options.inputLanguage === 'Hindi' && !options.translateTo)) return 'hi';
    if (options.translateTo === 'Telugu' || (options.inputLanguage === 'Telugu' && !options.translateTo)) return 'te';
    if (options.translateTo === 'Spanish' || (options.inputLanguage === 'Spanish' && !options.translateTo)) return 'es';
    if (options.translateTo === 'French' || (options.inputLanguage === 'French' && !options.translateTo)) return 'fr';
    if (options.translateTo === 'German' || (options.inputLanguage === 'German' && !options.translateTo)) return 'de';
    if (options.translateTo === 'Japanese' || (options.inputLanguage === 'Japanese' && !options.translateTo)) return 'ja';
    if (options.translateTo === 'Mandarin' || (options.inputLanguage === 'Mandarin' && !options.translateTo)) return 'zh';

    // Heuristics
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
    
    // Check for accented characters common in Latin languages
    if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(text)) return 'es';
    if (/[àâçéèêëîïôûùÿÀÂÇÉÈÊËÎÏÔÛÙŸ]/.test(text)) return 'fr';
    if (/[äöüßÄÖÜ]/.test(text)) return 'de';

    return 'en';
  };

  const getSentences = (text: string) => {
    if (!text) return [];
    // Split by common delimiters and filter small crumbs
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 1);
  };

  const playSentence = (index: number) => {
    window.speechSynthesis.cancel();
    const sentences = getSentences(transcription);
    
    if (index < 0 || index >= sentences.length) {
      setIsSpeaking(false);
      setCurrentSentenceIndex(-1);
      return;
    }

    setCurrentSentenceIndex(index);
    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    
    let targetVoice = voices.find(v => v.name === options.ttsVoice);
    if (!targetVoice || options.ttsVoice === '') {
      const detectedLang = detectLanguage(sentences[index]);
      const matches = voices.filter(v => v.lang.toLowerCase().startsWith(detectedLang));
      if (matches.length > 0) targetVoice = matches[0];
    }

    if (targetVoice) {
      utterance.voice = targetVoice;
      utterance.lang = targetVoice.lang;
    }
    
    utterance.rate = options.ttsRate || 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      // Small pause between sentences for natural feel
      setTimeout(() => {
        if (index + 1 < sentences.length) {
          playSentence(index + 1);
        } else {
          setIsSpeaking(false);
          setCurrentSentenceIndex(-1);
        }
      }, 300);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentSentenceIndex(-1);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSentenceIndex(-1);
  };

  const handlePlaybackToggle = () => {
    if (isSpeaking) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsSpeaking(true);
      } else {
        playSentence(currentSentenceIndex === -1 ? 0 : currentSentenceIndex);
      }
    }
  };

  const skipForward = () => {
    const sentences = getSentences(transcription);
    const next = currentSentenceIndex + 1;
    if (next < sentences.length) {
      playSentence(next);
    }
  };

  const skipBackward = () => {
    const prev = currentSentenceIndex - 1;
    if (prev >= 0) {
      playSentence(prev);
    } else {
      playSentence(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      if (audioBlob.size < 1000) {
        throw new Error('Audio fragment too short. Please record for a few seconds.');
      }

      const base64 = await blobToBase64(audioBlob);
      const result = await transcribeAudio(base64, audioBlob.type, options);
      
      if (!result) {
        throw new Error('No transcription generated. The model returned an empty result.');
      }

      const cleanedText = result;
      
      if (transcription) {
        setTranscriptionHistory(prev => [transcription, ...prev].slice(0, 5));
      }
      setTranscription(cleanedText);

      if (options.enableTTS) {
        playSentence(0);
      }

    } catch (err: any) {
      console.error(err);
      let message = 'An unexpected error occurred during transcription.';
      
      if (err.message?.includes('API key')) {
        message = 'Authentication error. Please check your Gemini API configuration.';
      } else if (err.message?.includes('short')) {
        message = err.message;
      } else if (err.message?.includes('empty result')) {
        message = err.message;
      } else if (navigator.onLine === false) {
        message = 'Network connection error. Please check your internet Link.';
      }
      
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (transcriptionHistory.length === 0) return;
    const previous = transcriptionHistory[0];
    setTranscriptionHistory(prev => prev.slice(1));
    setTranscription(previous);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setError('Clipboard access denied. Please manually select and copy the text.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    
    const colors: Record<string, string> = {
      yellow: 'bg-yellow-200 border-yellow-400',
      green: 'bg-green-100 border-green-300',
      blue: 'bg-blue-100 border-blue-300',
      black: 'bg-black/10 border-black/30'
    };

    const activeColorClass = colors[options.searchHighlightColor || 'yellow'];

    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className={`${activeColorClass} text-black border-b-2 font-semibold px-0.5 rounded-sm shadow-sm transition-all animate-pulse`}>{part}</mark> 
        : part
    );
  };

  const resetSession = () => {
    setTranscription('');
    clearAudio();
  };

  const saveToArchive = () => {
    if (!transcription) return;
    setTranscriptionHistory(prev => {
      if (prev.includes(transcription)) return prev;
      return [transcription, ...prev].slice(0, 10);
    });
    setArchived(true);
    setTimeout(() => setArchived(false), 2000);
  };

  const handleShare = async () => {
    if (!visualCardRef.current || !transcription) return;
    
    setIsSharing(true);
    try {
      // Small delay to ensure any rendering catch-up
      await new Promise(r => setTimeout(r, 100));
      
      const dataUrl = await toPng(visualCardRef.current, {
        quality: 0.95,
        backgroundColor: '#F9F7F2',
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `vocalis-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Vocalis Transcript',
          text: 'Shared via Vocalis',
        });
      } else {
        // Fallback: Download
        const link = document.createElement('a');
        link.download = `vocalis-transcript-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Share failed:', err);
      setError('Failed to generate visual card. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const clearHistory = () => {
    if (confirm('Clear all session history?')) {
      setTranscriptionHistory([]);
    }
  };

  return (
    <div className="h-screen w-full bg-[#F9F7F2] text-[#1C1C1C] font-sans flex flex-col overflow-hidden selection:bg-black selection:text-white">
      {/* Hidden Visual Card for rendering */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none" aria-hidden="true">
        <div 
          ref={visualCardRef}
          style={{ width: '600px', padding: '60px' }}
          className="bg-[#F9F7F2] font-sans text-black relative flex flex-col min-h-[600px] border-[20px] border-black/5"
        >
          <div className="flex justify-between items-start mb-12">
            <div className="flex items-center gap-4">
              <VocalisLogo className="w-12 h-12 text-black" />
              <div className="text-3xl font-black italic tracking-tighter lowercase">
                vocalis
              </div>
            </div>
            <div className="text-[10px] uppercase font-black tracking-[0.4em] text-black/20 italic mt-4">
              Neural Capture Finalized
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div 
              className={`${options.fontFamily === 'sans' ? 'font-sans' : options.fontFamily === 'mono' ? 'font-mono' : 'font-serif'} text-black prose prose-headings:font-medium prose-p:leading-relaxed`}
              style={{ fontSize: `${options.fontSize}px` }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {transcription}
              </ReactMarkdown>
            </div>
          </div>

          <div className="mt-16 pt-12 border-t-4 border-black flex justify-between items-end">
            <div>
              <div className="text-[10px] uppercase font-bold text-black/30 tracking-widest mb-1">Generated Output</div>
              <div className="text-xl font-serif italic text-black/60">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div className="flex items-center gap-1.5 opacity-20 scale-75 origin-bottom-right">
              <span className="text-[8px] uppercase font-black tracking-widest">Shared via Vocalis</span>
            </div>
          </div>
          
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply"
            style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/felt.png")' }}
          />
        </div>
      </div>

      {audioBlob && (
        <audio 
          ref={audioRef} 
          src={URL.createObjectURL(audioBlob)} 
          className="hidden"
        />
      )}

      {/* Branding Header (Universal) */}
      <header className="w-full h-16 md:h-20 flex items-center justify-between px-6 md:px-12 bg-white/40 border-b border-black/5 shrink-0 z-[60]">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex items-center gap-2 md:gap-3 group cursor-pointer" onClick={() => setActiveTab('live')}>
            <VocalisLogo className="w-8 h-8 md:w-10 md:h-10 text-black group-hover:scale-110 transition-transform duration-500" />
            <div className="text-xl md:text-2xl font-black italic tracking-tighter lowercase">
              vocalis
            </div>
          </div>
          <span className="hidden md:block text-[8px] uppercase font-black tracking-[0.4em] text-black/20 border-l border-black/10 pl-5 h-4 flex items-center">
            Engine.v3
          </span>
        </div>
        
        <div className="bg-black/[0.04] backdrop-blur-md border border-black/5 rounded-full px-4 py-1.5 flex items-center gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500/60 shadow-[0_0_8px_rgba(34,197,94,0.4)]'}`} />
          <span className="text-[8px] uppercase font-black tracking-widest text-black/40">
            {isRecording ? 'Signal Active' : 'System Ready'}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Analytics/Stats - Desktop Sidebar or Mobile Collapsible */}
        <aside className={`${activeTab === 'live' ? 'hidden md:flex' : 'hidden'} w-full md:w-80 border-r border-black/10 p-10 pb-32 flex-col justify-between bg-white/20 overflow-y-auto`}>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-12"
          >
            <div>
              <h2 className="text-[10px] uppercase tracking-widest text-black/40 font-black mb-8 italic flex items-center gap-2">
                Session Analytics
              </h2>
              <div className="space-y-10">
                <div className="flex flex-col">
                  <span className="text-5xl font-serif leading-none tracking-tighter">{formatTime(recordingTime)}</span>
                  <span className="text-[10px] uppercase font-bold text-black/30 mt-2 tracking-widest">Active Duration</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-4xl font-serif leading-none tracking-tight capitalize">
                    {isProcessing ? 'Polishing' : isRecording ? 'Capturing' : audioBlob ? 'Buffered' : 'Ready'}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-black/30 mt-2 tracking-widest">Engine State</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-[10px] uppercase tracking-widest text-black/40 font-black mb-6 italic">Intellectual Output</h2>
              <div className="space-y-3">
                {[
                  { id: 'adaptive', label: 'AI Adaptive' },
                  { id: 'prose', label: 'Clean Prose' },
                  { id: 'list', label: 'Action List' },
                  { id: 'email', label: 'Formal Email' }
                ].map((fmt, i) => (
                  <motion.button
                    key={fmt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + (i * 0.05) }}
                    onClick={() => setOptions({...options, format: fmt.id as any})}
                    className={`w-full p-4 border text-left transition-all rounded-sm text-[10px] uppercase font-black tracking-widest shadow-sm ${options.format === fmt.id ? 'border-black bg-white scale-[1.02]' : 'border-black/5 hover:border-black/20 hover:bg-white/50'}`}
                  >
                    {fmt.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </aside>

        {/* Main Recorder/Transcriber Area */}
        <section className={`flex-1 flex flex-col bg-white/5 md:bg-white/10 relative overflow-y-auto pb-40 ${activeTab !== 'live' ? 'hidden md:flex' : 'flex'}`}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-start px-6 py-4 md:p-12 md:pt-8 max-w-4xl mx-auto w-full"
          >
            <AnimatePresence mode="wait">
              {transcription ? (
                <motion.div 
                  key="output"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 md:space-y-12"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4 md:pb-6">
                    <div className="flex gap-2 items-center">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-[10px] uppercase tracking-widest font-black">Neural Cleanup Finalized</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/[0.02] p-3 rounded-xl border border-black/[0.05] w-full max-w-lg">
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[7px] uppercase font-black text-black/25 tracking-[0.2em]">Text Scale</span>
                          <span className="text-[8px] font-black text-black/50">{options.fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setOptions(prev => ({...prev, fontSize: Math.max(12, (prev.fontSize || 16) - 2)}))}
                            className="w-6 h-6 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-md text-[10px] font-bold text-black/40 transition-colors"
                          >
                            A-
                          </button>
                          <input 
                            type="range" 
                            min="12" 
                            max="48" 
                            step="2" 
                            value={options.fontSize} 
                            onChange={(e) => setOptions({...options, fontSize: parseInt(e.target.value)})}
                            className="custom-range flex-1 h-1 bg-black/5 rounded-full appearance-none cursor-pointer accent-black"
                          />
                          <button 
                            onClick={() => setOptions(prev => ({...prev, fontSize: Math.min(48, (prev.fontSize || 16) + 2)}))}
                            className="w-6 h-6 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-md text-[14px] font-bold text-black/40 transition-colors"
                          >
                            A+
                          </button>
                        </div>
                      </div>
                      <div className="hidden sm:block w-px h-5 bg-black/[0.05]" />
                      <div className="flex bg-black/[0.03] p-0.5 rounded-lg border border-black/[0.05] shrink-0">
                        {[
                          { id: 'serif', label: 'Serif' },
                          { id: 'sans', label: 'Sans' },
                          { id: 'mono', label: 'Mono' }
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setOptions({...options, fontFamily: f.id as any})}
                            className={`px-3 py-1 text-[7px] uppercase font-black tracking-widest rounded-md transition-all ${options.fontFamily === f.id ? 'bg-white text-black shadow-sm' : 'text-black/30 hover:text-black/50'}`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10 md:space-y-12 min-h-[300px]">
                    <div 
                      className={`markdown-body ${options.fontFamily === 'sans' ? 'font-sans' : options.fontFamily === 'mono' ? 'font-mono' : 'font-serif'} transition-all duration-700`}
                      style={{ fontSize: `${options.fontSize}px` }}
                    >
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({node, ...props}) => <h1 style={{ fontSize: `${(options.fontSize || 16) * 1.8}px` }} className="font-medium leading-[1.15] tracking-tight text-black mb-6 mt-12 first:mt-0" {...props} />,
                          h2: ({node, ...props}) => <h2 style={{ fontSize: `${(options.fontSize || 16) * 1.5}px` }} className="font-medium leading-[1.2] tracking-tight text-black mb-4 mt-8" {...props} />,
                          h3: ({node, ...props}) => <h3 style={{ fontSize: `${(options.fontSize || 16) * 1.3}px` }} className="font-bold text-black mb-3 mt-6" {...props} />,
                          p: ({node, ...props}) => <p className="leading-[1.7] text-black/80 mb-6 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-6 space-y-2 text-black/80" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-6 space-y-2 text-black/80" {...props} />,
                          li: ({node, ...props}) => <li className="pl-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-black text-black" {...props} />,
                          em: ({node, ...props}) => <em className="italic opacity-90" {...props} />,
                        }}
                      >
                        {transcription}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  <div className="pt-4 md:pt-8 border-t-2 md:border-t-8 border-black flex flex-col gap-4">
                    {/* Primary Actions Grid */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={copyToClipboard}
                        className="flex-1 px-4 py-5 bg-black text-white text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 rounded-xl md:rounded-sm shadow-xl shadow-black/10 group overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        <span className="relative">{copied ? 'Captured' : 'Copy'}</span>
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleShare}
                        disabled={isSharing}
                        className={`flex-1 px-4 py-5 border text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all rounded-xl md:rounded-sm border-black text-black hover:bg-black/5 hover:scale-[1.01] ${isSharing ? 'opacity-50' : ''}`}
                      >
                        {isSharing ? <RefreshCcw size={18} className="animate-spin" /> : <Share2 size={18} />}
                        {isSharing ? 'Generating...' : 'Share Card'}
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={saveToArchive}
                        className={`flex-1 px-4 py-5 border text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all rounded-xl md:rounded-sm ${archived ? 'bg-green-500 border-green-500 text-white' : 'border-black text-black hover:bg-black/5 hover:scale-[1.01]'}`}
                      >
                        {archived ? <Check size={18} /> : <History size={18} />}
                        {archived ? 'Saved' : 'Archive'}
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={resetSession}
                        className="flex-1 px-4 py-5 border border-black/10 text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 hover:border-black transition-all rounded-xl md:rounded-sm hover:bg-black/5"
                      >
                        <RotateCcw size={18} /> Reset
                      </motion.button>
                    </div>

                    {/* Apple-inspired Compact Player */}
                    <div className="bg-white/40 backdrop-blur-xl p-4 rounded-[2.5rem] border border-black/5 flex flex-col gap-4 relative overflow-hidden group/player shadow-2xl shadow-black/5">
                      <div className="flex items-center gap-4">
                        {/* Audio Visualization Accent */}
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-black/10 relative overflow-hidden">
                          <div className="flex items-end gap-1 h-4">
                            {[0.2, 0.4, 0.1, 0.3].map((delay, i) => (
                              <motion.div 
                                key={i}
                                animate={isSpeaking ? { height: [4, 16, 8, 14, 4] } : { height: 4 }}
                                transition={{ repeat: Infinity, duration: 0.8, delay }}
                                className="w-1 bg-current rounded-full"
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 leading-none">Playback Engine</span>
                            <div className={`w-1 h-1 rounded-full ${isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-black/10'}`} />
                          </div>
                          <div className="text-[13px] font-bold text-black/70 truncate italic leading-tight">
                            {getSentences(transcription)[currentSentenceIndex] || 'Ready for playback'}
                          </div>
                        </div>

                        {/* Speed Selection */}
                        <button 
                          onClick={() => {
                            const rates = [1, 1.25, 1.5, 2, 0.75];
                            const current = options.ttsRate || 1;
                            const nextIndex = (rates.indexOf(current) + 1) % rates.length;
                            setOptions({...options, ttsRate: rates[nextIndex]});
                          }}
                          className="h-9 px-3 rounded-xl bg-black/5 text-[10px] font-black text-black/40 hover:bg-black hover:text-white transition-all uppercase tracking-tighter shrink-0 active:scale-95"
                        >
                          {options.ttsRate || 1}x
                        </button>
                      </div>

                      {/* Controls Area */}
                      <div className="flex flex-col gap-3">
                        {/* Seek Bar */}
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black text-black/20 w-6 tabular-nums">
                            {currentSentenceIndex !== -1 ? currentSentenceIndex + 1 : 0}
                          </span>
                          <div 
                            className="flex-1 h-1.5 bg-black/5 rounded-full relative cursor-pointer group/seek"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const percent = x / rect.width;
                              const sentences = getSentences(transcription);
                              const nextIndex = Math.floor(percent * sentences.length);
                              if (nextIndex >= 0 && nextIndex < sentences.length) playSentence(nextIndex);
                            }}
                          >
                            <motion.div 
                              className="absolute inset-y-0 left-0 bg-black/50 rounded-full"
                              animate={{ width: getSentences(transcription).length > 0 ? `${((currentSentenceIndex + 1) / getSentences(transcription).length) * 100}%` : '0%' }}
                            />
                            {/* Seek Handle (Apple Style) */}
                            <motion.div 
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-black rounded-full opacity-0 group-hover/seek:opacity-100 transition-opacity"
                              animate={{ left: getSentences(transcription).length > 0 ? `${((currentSentenceIndex + 1) / getSentences(transcription).length) * 100}%` : '0%', x: '-50%' }}
                            />
                          </div>
                          <span className="text-[9px] font-black text-black/20 w-6 text-right tabular-nums">
                            {getSentences(transcription).length}
                          </span>
                        </div>

                        {/* Transport Controls */}
                        <div className="flex items-center justify-center gap-12 pb-1">
                          <button 
                            onClick={skipBackward}
                            disabled={currentSentenceIndex <= 0}
                            className="text-black/40 hover:text-black transition-all disabled:opacity-10 hover:scale-110 active:scale-90"
                          >
                            <SkipBack size={24} fill="currentColor" />
                          </button>
                          
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            animate={isSpeaking ? { 
                              boxShadow: ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 20px rgba(0,0,0,0.1)", "0px 0px 0px rgba(0,0,0,0)"]
                            } : {}}
                            transition={{ repeat: Infinity, duration: 2 }}
                            onClick={handlePlaybackToggle}
                            className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-white shadow-xl shadow-black/20 transition-transform active:scale-95"
                          >
                            {isSpeaking ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                          </motion.button>

                          <button 
                            onClick={skipForward}
                            disabled={currentSentenceIndex >= getSentences(transcription).length - 1}
                            className="text-black/40 hover:text-black transition-all disabled:opacity-10 hover:scale-110 active:scale-90"
                          >
                            <SkipForward size={24} fill="currentColor" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="recorder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center text-center space-y-6 md:space-y-8"
                >
                  <div className="flex gap-1.5 flex-wrap justify-center max-w-md">
                    {['AI Adaptive', 'Meeting notes', 'Email draft', 'Key Insights', 'Action Items', 'Summarize'].map(chip => (
                      <motion.span 
                        key={chip} 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (chip === 'AI Adaptive') setOptions({...options, format: 'adaptive'});
                          if (chip === 'Meeting notes') setOptions({...options, format: 'list'});
                          if (chip === 'Email draft') setOptions({...options, format: 'email'});
                          if (chip === 'Key Insights') setOptions({...options, format: 'prose'});
                          if (chip === 'Action Items') setOptions({...options, format: 'list'});
                          if (chip === 'Summarize') setOptions({...options, format: 'adaptive', tone: 'concise' as any});
                        }}
                        className={`px-4 py-1.5 border rounded-full text-[9px] uppercase font-black cursor-pointer transition-all shadow-sm ${
                          (chip === 'AI Adaptive' && options.format === 'adaptive' && (options.tone as any) !== 'concise') ||
                          (chip === 'Meeting notes' && options.format === 'list') ||
                          (chip === 'Email draft' && options.format === 'email') ||
                          (chip === 'Key Insights' && options.format === 'prose') ||
                          (chip === 'Action Items' && options.format === 'list') ||
                          (chip === 'Summarize' && (options.tone as any) === 'concise')
                            ? 'bg-black text-white border-black ring-2 ring-black/5' 
                            : 'bg-black/[0.04] border-black/5 text-black/50 hover:text-black/80 hover:bg-white'
                        }`}
                      >
                        {chip}
                      </motion.span>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-8 w-full max-w-5xl">
                    {/* Left Waveform */}
                    <div className="w-12 sm:w-20 md:w-40 lg:w-48 h-16 md:h-24 scale-x-[-1]">
                      <Waveform 
                        analyser={analyser} 
                        isRecording={isRecording} 
                        sensitivity={options.waveformSensitivity}
                        color={options.waveformColor}
                        style={options.waveformStyle}
                        className={`w-full h-full transition-opacity duration-700 ${isRecording ? 'opacity-100' : 'opacity-20'}`}
                      />
                    </div>

                    <div className="relative shrink-0">
                      {isRecording && (
                        <>
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.8, opacity: 0.1 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                            className="absolute inset-0 bg-red-500 rounded-full blur-3xl pointer-events-none"
                          />
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.4, opacity: 0.2 }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut", delay: 0.5 }}
                            className="absolute inset-0 bg-orange-400 rounded-full blur-2xl pointer-events-none"
                          />
                        </>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-36 h-36 md:w-48 md:h-48 rounded-[2.5rem] md:rounded-full border border-black/10 flex items-center justify-center transition-all duration-700 relative bg-white border shadow-2xl group ${isRecording ? 'border-red-500 scale-95 shadow-red-500/10' : 'hover:border-black shadow-black/5'}`}
                      >
                        <div className={`transition-all duration-500 ${isRecording ? 'text-red-500' : 'text-black'}`}>
                          {isRecording ? <Square size={44} fill="currentColor" strokeWidth={0} className="md:w-16 md:h-16" /> : <Mic size={44} strokeWidth={1} className="md:w-16 md:h-16" />}
                        </div>
                        
                        <div className="absolute bottom-6 md:absolute md:inset-[-40px] opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex items-center justify-center pointer-events-none">
                          <span className="text-[7px] md:text-[10px] uppercase font-black tracking-[0.4em] text-black/30 md:text-black/20 italic">
                            {isRecording ? 'Capturing...' : 'Tap to Start'}
                          </span>
                        </div>
                      </motion.button>
                    </div>

                    {/* Right Waveform */}
                    <div className="w-12 sm:w-20 md:w-40 lg:w-48 h-16 md:h-24">
                      <Waveform 
                        analyser={analyser} 
                        isRecording={isRecording} 
                        sensitivity={options.waveformSensitivity}
                        color={options.waveformColor}
                        style={options.waveformStyle}
                        className={`w-full h-full transition-opacity duration-700 ${isRecording ? 'opacity-100' : 'opacity-20'}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5 max-w-sm w-full">
                    <h2 className="text-3xl md:text-4xl font-serif tracking-tighter leading-none italic">
                      {isRecording ? 'Listening...' : audioBlob ? 'Buffered' : 'Vocalis'}
                    </h2>
                    
                    <p className="text-[11px] md:text-xs font-serif text-black/40 leading-relaxed italic px-4">
                      {isRecording 
                        ? `Buffer sync at ${formatTime(recordingTime)}.` 
                        : audioBlob 
                        ? 'Fragment isolated. Ready for neural cleanup.'
                        : 'Capturing raw fragments, filtering for executive clarity.'
                      }
                    </p>

                    {!isRecording && !audioBlob && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="pt-2 px-6"
                      >
                        <div className="pt-4">
                          <p className="text-[11px] md:text-xs leading-loose text-black/30 font-black max-w-[320px] mx-auto uppercase tracking-[0.3em]">
                            Welcome. Speak naturally. Our neural engine will refine your raw speech into polished fragments suitable for professional correspondence.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {audioBlob && !isProcessing && (
                    <div className="flex flex-col items-center gap-4">
                      {error && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-xl text-red-500 text-[10px] uppercase font-black tracking-widest"
                        >
                          {error}
                        </motion.div>
                      )}
                      <motion.button 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleTranscribe}
                        className="w-full sm:w-auto px-10 py-5 bg-black text-white text-[11px] uppercase font-black tracking-[0.3em] flex items-center justify-center gap-4 rounded-xl md:rounded-sm shadow-2xl relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <Sparkles size={18} className="transition-transform group-hover:rotate-12" /> 
                        <span className="relative">Refine Fragment ↗</span>
                      </motion.button>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCcw size={32} className="animate-spin text-black/10" strokeWidth={1.5} />
                      <span className="text-[9px] uppercase font-black tracking-[0.2em] animate-pulse italic">Thinking...</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* Configurations - Apple Settings Style Sidebar */}
        <aside className={`${activeTab === 'settings' ? 'flex' : 'hidden'} md:flex w-full md:w-80 md:bg-[#F2F2F7] flex-col overflow-y-auto custom-scrollbar relative z-[60] border-l border-black/[0.03]`}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 p-5 space-y-8 pb-32"
          >
            <div className="px-1 pt-2 pb-1">
              <h1 className="text-2xl font-bold text-black tracking-tight">Settings</h1>
            </div>

            {/* AI Intelligence Group */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold text-black/40 uppercase tracking-wider px-4">Intelligence</h2>
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.03]">
                {/* Input Language */}
                <div className="flex items-center gap-4 p-4 hover:bg-black/[0.01] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                    <Globe size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-black">Input Language</div>
                  </div>
                  <select 
                    value={options.inputLanguage}
                    onChange={(e) => setOptions({...options, inputLanguage: e.target.value})}
                    className="bg-transparent text-sm text-black/40 font-medium focus:outline-none cursor-pointer appearance-none text-right pr-4"
                  >
                    <option value="auto">Auto</option>
                    <option value="English">English</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                  </select>
                </div>

                {/* Tone Selector */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white">
                      <Sparkles size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-black">Cognitive Tone</div>
                    </div>
                  </div>
                  <div className="flex bg-[#F2F2F7] p-1 rounded-xl">
                    {[
                      { id: 'default', label: 'Adaptive' },
                      { id: 'formal', label: 'Pro' },
                      { id: 'casual', label: 'Chat' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setOptions({...options, tone: t.id as any})}
                        className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${options.tone === t.id ? 'bg-white text-black shadow-sm ring-1 ring-black/5' : 'text-black/40 hover:text-black/60'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Translation */}
                <div className="flex items-center gap-4 p-4 hover:bg-black/[0.01] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white">
                    <Languages size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-black">Translation</div>
                  </div>
                  <select 
                    value={options.translateTo}
                    onChange={(e) => setOptions({...options, translateTo: e.target.value})}
                    className="bg-transparent text-sm text-black/40 font-medium focus:outline-none cursor-pointer appearance-none text-right pr-4"
                  >
                    <option value="">Off</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Mandarin">Mandarin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display & Font Group */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold text-black/40 uppercase tracking-wider px-4">Display</h2>
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.03]">
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                      <Type size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-black">Typography</div>
                    </div>
                  </div>
                  <div className="flex bg-[#F2F2F7] p-1 rounded-xl">
                    {[
                      { id: 'serif', label: 'Serif' },
                      { id: 'sans', label: 'Sans' },
                      { id: 'mono', label: 'Mono' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setOptions({...options, fontFamily: f.id as any})}
                        className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${options.fontFamily === f.id ? 'bg-white text-black shadow-sm ring-1 ring-black/5' : 'text-black/40 hover:text-black/60'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center bg-[#F2F2F7]/50 p-3 rounded-xl border border-black/[0.02]">
                    <button 
                      onClick={() => setOptions(prev => ({...prev, fontSize: Math.max(12, (prev.fontSize || 16) - 2)}))}
                      className="w-10 h-10 flex items-center justify-center bg-white shadow-sm ring-1 ring-black/5 rounded-lg active:scale-95 transition-transform"
                    >
                      <span className="text-xs font-bold">A</span>
                    </button>
                    <div className="flex-1 px-4">
                      <input 
                        type="range" 
                        min="12" 
                        max="48" 
                        step="2" 
                        value={options.fontSize} 
                        onChange={(e) => setOptions({...options, fontSize: parseInt(e.target.value)})}
                        className="custom-range w-full h-1 bg-black/10 rounded-full appearance-none cursor-pointer accent-black"
                      />
                    </div>
                    <button 
                      onClick={() => setOptions(prev => ({...prev, fontSize: Math.min(48, (prev.fontSize || 16) + 2)}))}
                      className="w-10 h-10 flex items-center justify-center bg-white shadow-sm ring-1 ring-black/5 rounded-lg active:scale-95 transition-transform"
                    >
                      <span className="text-xl font-bold">A</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizer Group */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold text-black/40 uppercase tracking-wider px-4">Visualizer</h2>
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.03]">
                <div className="p-5">
                   <div className="p-6 bg-[#F2F2F7] rounded-[1.5rem] border border-black/[0.02] mb-4">
                      <div className="w-full h-16 flex items-center justify-center overflow-hidden">
                        <Waveform 
                          analyser={analyser} 
                          isRecording={isRecording} 
                          sensitivity={options.waveformSensitivity || 1}
                          color={options.waveformColor}
                          style={options.waveformStyle}
                          className="w-full h-full opacity-80"
                        />
                      </div>
                   </div>

                   <div className="space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-gray-500 flex items-center justify-center text-white">
                          <ActivityIcon size={18} />
                        </div>
                        <div className="flex-1 text-sm font-medium">Style</div>
                        <div className="flex bg-[#F2F2F7] p-1 rounded-xl shrink-0">
                          {['smooth', 'sharp', 'blocks'].map((s) => (
                            <button
                              key={s}
                              onClick={() => setOptions({...options, waveformStyle: s as any})}
                              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${options.waveformStyle === s ? 'bg-white text-black shadow-sm ring-1 ring-black/5' : 'text-black/30'}`}
                            >
                              {s === 'smooth' ? 'Curve' : s === 'sharp' ? 'Node' : 'Solid'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-[11px] font-medium text-black/40 px-1">
                            <span>Sensitivity</span>
                            <span>{Math.round((options.waveformSensitivity || 1) * 100)}%</span>
                         </div>
                         <input 
                            type="range" 
                            min="0.2" 
                            max="3" 
                            step="0.1" 
                            value={options.waveformSensitivity} 
                            onChange={(e) => setOptions({...options, waveformSensitivity: parseFloat(e.target.value)})}
                            className="custom-range w-full"
                          />
                      </div>

                      <div className="space-y-3">
                         <span className="text-[11px] font-medium text-black/40 px-1">Signal Spectrum</span>
                         <div className="flex justify-between items-center bg-[#F2F2F7]/50 p-2 rounded-xl border border-black/[0.02]">
                            {['black', 'blue', 'emerald', 'purple', 'rainbow'].map(c => (
                              <button
                                key={c}
                                onClick={() => setOptions({...options, waveformColor: c})}
                                className={`w-8 h-8 rounded-full border-2 p-0.5 transition-all ${options.waveformColor === c ? 'border-primary ring-2 ring-black/5 scale-110 shadow-md' : 'border-black/5 opacity-50'}`}
                              >
                                <div className={`w-full h-full rounded-full ${c === 'rainbow' ? 'bg-gradient-to-br from-red-400 via-green-400 to-blue-400' : c === 'black' ? 'bg-black' : c === 'blue' ? 'bg-blue-500' : c === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                              </button>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-3">
                         <span className="text-[11px] font-medium text-black/40 px-1">Search Highlight</span>
                         <div className="flex gap-2">
                            {['yellow', 'green', 'blue', 'black'].map(c => (
                              <button
                                key={c}
                                onClick={() => setOptions({...options, searchHighlightColor: c})}
                                className={`flex-1 h-8 rounded-lg border transition-all ${options.searchHighlightColor === c ? 'border-black bg-white shadow-sm ring-2 ring-black/5' : 'border-black/5 bg-[#F2F2F7]/50'}`}
                              >
                                <div className={`w-3 h-3 rounded-full mx-auto ${c === 'yellow' ? 'bg-yellow-200' : c === 'green' ? 'bg-green-100' : c === 'blue' ? 'bg-blue-100' : 'bg-black/10'}`} />
                              </button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Vocal Synthesis Group */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold text-black/40 uppercase tracking-wider px-4">Audio Synthesis</h2>
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden divide-y divide-black/[0.03]">
                {/* Toggle Enable */}
                <div className="flex items-center gap-4 p-4">
                  <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center text-white">
                    <Volume2 size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-black">Voice Feedback</div>
                    <div className="text-[10px] text-black/40">Read out cleaned fragments</div>
                  </div>
                  <div 
                    onClick={() => setOptions({...options, enableTTS: !options.enableTTS})}
                    className={`w-12 h-7 rounded-full relative transition-all cursor-pointer p-0.5 ring-1 ring-black/[0.05] ${options.enableTTS ? 'bg-[#34C759]' : 'bg-black/10'}`}
                  >
                    <motion.div 
                      animate={{ x: options.enableTTS ? 20 : 0 }}
                      className="w-6 h-6 rounded-full bg-white shadow-sm border border-black/[0.02]" 
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {options.enableTTS && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden divide-y divide-black/[0.03]"
                    >
                      {/* Voice Identity */}
                      <div className="flex items-center gap-4 p-4 bg-black/[0.01]">
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] uppercase font-bold text-black/30 tracking-widest block mb-1">Identity</label>
                          <select 
                            value={options.ttsVoice}
                            onChange={(e) => setOptions({...options, ttsVoice: e.target.value})}
                            className="bg-transparent text-sm font-medium text-black/60 focus:outline-none w-full appearance-none cursor-pointer"
                          >
                            {voices.map((voice, idx) => (
                              <option key={idx} value={voice.name}>
                                {voice.name.replace('Natural', '✧').slice(0, 25)} ({voice.lang.split('-')[0].toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>
                        <ChevronRight size={14} className="text-black/20" />
                      </div>

                      {/* Rate Slider */}
                      <div className="p-4 space-y-3">
                         <div className="flex justify-between items-center text-[10px] font-bold text-black/30 tracking-tight">
                           <span>Velocity</span>
                           <span className="text-black/60">{options.ttsRate}x</span>
                         </div>
                         <div className="flex items-center gap-4">
                            <span className="text-[10px] opacity-20">🐢</span>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="2" 
                              step="0.1" 
                              value={options.ttsRate} 
                              onChange={(e) => setOptions({...options, ttsRate: parseFloat(e.target.value)})}
                              className="custom-range flex-1"
                            />
                            <span className="text-[10px] opacity-20">🐇</span>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Branding/Info */}
            <div className="px-4 text-center space-y-4 pt-12 pb-8">
               <VocalisLogo className="w-10 h-10 text-black mx-auto" />
               <div className="space-y-1">
                 <div className="text-[10px] font-black tracking-[0.4em] uppercase italic text-black">Vocalis Engine</div>
                 <div className="text-[8px] font-bold text-black/60">Build 2404A.993</div>
               </div>
            </div>
          </motion.div>
        </aside>

        {/* History Tab for Mobile */}
        <aside className={`${activeTab === 'history' ? 'flex' : 'hidden'} md:hidden w-full p-8 flex-col bg-white/20 overflow-y-auto`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col"
          >
           <div className="flex items-center justify-between mb-8">
             <h2 className="text-[10px] uppercase tracking-widest text-black/50 font-black italic">History</h2>
             {transcriptionHistory.length > 0 && (
               <button 
                 onClick={clearHistory}
                 className="text-[9px] uppercase font-black text-red-500/60 hover:text-red-500 transition-colors"
               >
                 Clear All
               </button>
             )}
           </div>
           {transcriptionHistory.length > 0 ? (
             <div className="space-y-4">
               {transcriptionHistory.map((text, i) => (
                 <motion.div 
                   key={i} 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.05 }}
                   className="p-5 bg-white border border-black/5 rounded-2xl shadow-sm"
                 >
                    <p className="text-sm font-serif italic text-black/60 line-clamp-2 mb-3">"{text}"</p>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setTranscription(text); setActiveTab('live'); }}
                      className="text-[9px] uppercase font-black tracking-widest text-black py-2 px-6 bg-black/5 rounded-full hover:bg-black hover:text-white transition-all shadow-sm"
                    >
                      Restore to Stage
                    </motion.button>
                 </motion.div>
               ))}
             </div>
           ) : (
             <p className="text-sm font-serif italic text-black/30">No buffered fragments.</p>
           )}
          </motion.div>
        </aside>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
        }
        
        .custom-range {
          -webkit-appearance: none;
          background: rgba(0, 0, 0, 0.1);
          height: 4px;
          border-radius: 2px;
        }

        .custom-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: black;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .custom-range::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: black;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      `}} />

      {/* Unified Floating Bottom Navigation (Apple Style) */}
      <div className="fixed bottom-6 inset-x-0 flex justify-center z-[100] px-6 pointer-events-none">
        <nav className="bg-white/80 backdrop-blur-2xl border border-black/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-full p-1.5 flex items-center gap-1 pointer-events-auto">
          {[
            { id: 'live', label: 'Capture', icon: Mic },
            { id: 'history', label: 'Archive', icon: RotateCcw },
            { id: 'settings', label: 'Config', icon: Settings },
          ].map((btn) => (
            <motion.button
              key={btn.id}
              onClick={() => setActiveTab(btn.id as any)}
              whileTap={{ scale: 0.94 }}
              className={`relative px-6 py-2.5 rounded-full flex flex-col items-center gap-0.5 transition-all duration-500 group ${activeTab === btn.id ? 'text-black' : 'text-black/30 hover:text-black/50'}`}
            >
              {activeTab === btn.id && (
                <motion.div 
                  layoutId="bottom-nav-pill"
                  className="absolute inset-0 bg-white shadow-sm rounded-full -z-10 border border-black/[0.05]"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <btn.icon 
                size={16} 
                strokeWidth={activeTab === btn.id ? 2.5 : 1.5} 
                className={`transition-all duration-300 ${activeTab === btn.id ? 'scale-110' : 'group-hover:scale-110'}`} 
              />
              <span className={`text-[8px] uppercase font-black tracking-[0.2em] transition-all duration-300 ${activeTab === btn.id ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 h-0 overflow-hidden'}`}>
                {btn.label}
              </span>
              
              {/* Active Indicator Dot */}
              {activeTab === btn.id && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 right-3 w-1 h-1 bg-black rounded-full"
                />
              )}
            </motion.button>
          ))}
        </nav>
      </div>
    </div>
  );
}
