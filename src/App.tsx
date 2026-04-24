import React, { useState, useRef, useEffect } from 'react';
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
  RotateCw,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
import { transcribeAudio, textToSpeech, TranscriptionOptions } from '@/src/lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper to strip markdown for TTS
const stripMarkdown = (text: string) => {
  return text
    .replace(/[*_~`]/g, '')
    .replace(/#+\s/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
};

// Helper to convert base64 PCM to WAV Blob
const pcmToWavBlob = (base64Pcm: string, sampleRate: number = 24000) => {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }

  // Add WAV header (44 bytes)
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, len, true);

  return new Blob([wavHeader, buffer], { type: 'audio/wav' });
};

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

interface ArchiveItem {
  id: string;
  text: string;
  timestamp: number;
  recordedAudioBlob?: Blob | null;
  generatedAudioBlob?: Blob | null;
  title: string;
}

function ImmersivePlayer({ item, onClose, options, setTranscriptionHistory, setSelectedArchiveItem }: { 
  item: ArchiveItem, 
  onClose: () => void, 
  options: TranscriptionOptions,
  setTranscriptionHistory: React.Dispatch<React.SetStateAction<ArchiveItem[]>>,
  setSelectedArchiveItem: React.Dispatch<React.SetStateAction<ArchiveItem | null>>
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(options.ttsRate || 1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const prepareAudio = async () => {
    // ... logic remains in useEffect but we can extract it or call it here for retry
  };

  const togglePlay = () => {
    if (audioRef.current && generatedUrl) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    } else if (!isGenerating) {
      // Logic to trigger re-run of effect or just manual call
      // We'll use a petty state to force re-run if needed
      setRetryCount(prev => prev + 1);
    }
  };

  const [retryCount, setRetryCount] = useState(0);

  // Use natural high-quality TTS for the immersive player
  useEffect(() => {
    let currentUrl: string | null = null;
    let isMounted = true;

    const runPrepare = async () => {
      setGeneratedUrl(null);
      setErrorStatus(null);
      
      if (item.generatedAudioBlob) {
        if (!isMounted) return;
        currentUrl = URL.createObjectURL(item.generatedAudioBlob);
        setGeneratedUrl(currentUrl);
        return;
      } 
      
      setIsGenerating(true);
      try {
        const base64Pcm = await textToSpeech(stripMarkdown(item.text), options.ttsVoice || 'Kore');
        if (base64Pcm && isMounted) {
          const wavBlob = pcmToWavBlob(base64Pcm);
          currentUrl = URL.createObjectURL(wavBlob);
          setGeneratedUrl(currentUrl);
          setTranscriptionHistory(prev => prev.map(i => 
            i.id === item.id ? { ...i, generatedAudioBlob: wavBlob } : i
          ));
          setSelectedArchiveItem(prev => {
            if (prev?.id === item.id) return { ...prev, generatedAudioBlob: wavBlob };
            return prev;
          });
        } else if (isMounted) {
          setErrorStatus('Neural engine took too long. Tap to retry.');
        }
      } catch (err) {
        console.error("Player Neural TTS generation failed:", err);
        if (isMounted) setErrorStatus('Neural generation failed. Check connection.');
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    runPrepare();
    return () => {
      isMounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [item.id, item.generatedAudioBlob, options.ttsVoice, retryCount]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds));
    }
  };

  const downloadItemAudio = () => {
    if (!item.generatedAudioBlob) return;
    const url = URL.createObjectURL(item.generatedAudioBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neural-${item.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
      className="fixed inset-0 z-[200] bg-[#F9F7F2] flex flex-col md:flex-row overflow-hidden shadow-2xl"
    >
      {/* Background Orbs */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ repeat: Infinity, duration: 20 }}
          className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] bg-black/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90] }}
          transition={{ repeat: Infinity, duration: 25 }}
          className="absolute -bottom-1/4 -right-1/4 w-[800px] h-[800px] bg-black/5 rounded-full blur-3xl" 
        />
      </div>

      <audio 
        ref={audioRef} 
        src={generatedUrl || undefined}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 md:p-10 flex items-center justify-between z-[210] pointer-events-none">
        <motion.button 
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }} 
          className="w-12 h-12 flex items-center justify-center bg-black/5 rounded-full backdrop-blur-md transition-all pointer-events-auto shadow-sm"
        >
          <ChevronDown className="text-black/60" size={24} />
        </motion.button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-black tracking-[0.3em] text-black/30 mb-0.5">Neural Playback</span>
          <span className="text-xs font-serif italic text-black/50 truncate max-w-[150px] md:max-w-[400px]">{item.title}</span>
        </div>
        <button 
          onClick={() => {
            const rates = [1, 1.25, 1.5, 2, 0.75];
            const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
            setPlaybackRate(rates[nextIdx]);
          }}
          className="w-12 h-12 flex items-center justify-center bg-black/5 rounded-full text-[10px] font-black pointer-events-auto backdrop-blur-md hover:bg-black/10 transition-all shadow-sm"
        >
          {playbackRate}x
        </button>
      </header>

      {/* Main Container for scroll on mobile */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden relative z-10">
        {/* Visualizer & Controls */}
        <div className="w-full md:flex-1 flex flex-col items-center justify-center p-6 pt-32 md:p-12 md:pt-12 min-h-screen md:min-h-0 bg-transparent">
          <motion.div 
            layoutId={`card-${item.id}`}
            className="w-full max-w-[420px] aspect-square bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] rounded-[48px] border border-black/5 p-10 md:p-14 flex flex-col justify-between overflow-hidden relative"
          >
            <div className="flex justify-between items-start">
              <VocalisLogo className="w-14 h-14 text-black" />
              <div className="flex gap-1">
                 {[1, 2, 3].map(i => (
                   <motion.div 
                     key={i}
                     animate={isPlaying ? { height: [4, 12, 4] } : { height: 4 }}
                     transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                     className="w-1 bg-black/20 rounded-full"
                   />
                 ))}
              </div>
            </div>
            
            <div className="space-y-6">
               <div className="w-12 h-1 bg-black/10 rounded-full" />
               <h3 className="text-2xl md:text-4xl font-serif leading-[1.1] text-black italic tracking-tight">{item.title}</h3>
            </div>
            
            <div className="flex justify-between items-end border-t border-black/5 pt-8">
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest text-black/30 mb-1.5">Archived Output</p>
                <p className="text-base font-serif italic text-black/60">
                  {new Date(item.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="text-right">
                 <p className="text-[8px] font-black text-black/20 tracking-tighter">VOCALIS_ENGINE</p>
                 <p className="text-[8px] font-black text-black/20">FRAGMENT_{item.id.slice(0, 4).toUpperCase()}</p>
              </div>
            </div>
          </motion.div>

          {/* Controls underneath the card */}
          <div className="w-full max-w-[420px] mt-12 md:mt-16 space-y-10 px-4">
            <div className="space-y-4">
              {errorStatus && (
                <div className="text-center pb-2">
                  <p className="text-[10px] uppercase font-black tracking-widest text-red-500/80 italic">{errorStatus}</p>
                </div>
              )}
              <div 
                className="relative w-full h-[6px] bg-black/5 rounded-full cursor-pointer group/progress"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = x / rect.width;
                  if (audioRef.current) audioRef.current.currentTime = percent * duration;
                }}
              >
                 <motion.div 
                   className="absolute left-0 top-0 h-full bg-black rounded-full"
                   style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                 />
              </div>
              <div className="flex justify-between text-[11px] font-black tracking-widest text-black/40 tabular-nums">
                <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                <span className="opacity-40">{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-4">
              <button onClick={() => skip(-15)} className="text-black/30 hover:text-black transition-colors active:scale-90"><RotateCcw size={32} /></button>
              <div className="flex items-center gap-12">
                <button onClick={() => skip(-10)} className="text-black/30 hover:text-black transition-colors active:scale-90"><SkipBack size={36} fill="currentColor" /></button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePlay}
                  disabled={isGenerating}
                  className={`w-24 h-24 bg-black text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all ${isGenerating ? 'opacity-50' : 'hover:shadow-black/20'}`}
                >
                  {isGenerating ? (
                    <RefreshCcw className="animate-spin text-white/50" size={36} />
                  ) : isPlaying ? (
                    <Pause size={40} fill="currentColor" />
                  ) : (
                    <Play size={40} fill="currentColor" className="ml-2" />
                  )}
                </motion.button>
                <button onClick={() => skip(10)} className="text-black/30 hover:text-black transition-colors active:scale-90"><SkipForward size={36} fill="currentColor" /></button>
              </div>
              <button onClick={() => skip(15)} className="text-black/30 hover:text-black transition-colors active:scale-90"><RotateCw size={32} /></button>
            </div>
          </div>
        </div>

        {/* Right Aspect: Immersive Text */}
        <div className="w-full md:flex-1 bg-white/40 md:bg-black/[0.01] p-8 md:p-20 flex flex-col justify-start md:justify-center overflow-y-auto md:overflow-y-auto custom-scrollbar backdrop-blur-3xl md:backdrop-blur-none border-t md:border-t-0 md:border-l border-black/5">
          <div className="max-w-[600px] mx-auto w-full space-y-12 md:space-y-16 py-12 md:py-0">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-black/10 animate-pulse" />
                <p className="text-[11px] uppercase font-black tracking-[0.3em] text-black/30 italic">Transcript Fragment</p>
              </div>
              <div className="markdown-body font-serif italic text-black/80 leading-[1.6] md:leading-[1.5] text-2xl md:text-4xl selection:bg-black selection:text-white transition-opacity duration-1000">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-3xl md:text-5xl font-medium text-black mb-8 mt-12 first:mt-0 leading-tight" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-2xl md:text-4xl font-medium text-black mb-6 mt-10" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-xl md:text-3xl font-bold text-black mb-4 mt-8" {...props} />,
                    p: ({node, ...props}) => <p className="mb-6 last:mb-0" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-8 mb-6 space-y-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-8 mb-6 space-y-2" {...props} />,
                    li: ({node, ...props}) => <li className="pl-2" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-black text-black not-italic" {...props} />,
                  }}
                >
                  {item.text}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="pt-12 border-t-2 border-black/5 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: 'white' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    navigator.clipboard.writeText(item.text);
                  }}
                  className="flex items-center justify-center gap-3 py-6 bg-white/50 border border-black/5 rounded-3xl text-[11px] uppercase font-black tracking-widest shadow-sm transition-all font-sans"
                >
                  <Copy size={16} /> Copy fragment
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: 'white' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadItemAudio}
                  disabled={!item.generatedAudioBlob}
                  className={`flex items-center justify-center gap-3 py-6 bg-white/50 border border-black/5 rounded-3xl text-[11px] uppercase font-black tracking-widest shadow-sm transition-all font-sans ${!item.generatedAudioBlob ? 'opacity-30' : ''}`}
                >
                  <Download size={16} /> {item.generatedAudioBlob ? 'Download Neural' : 'Generating...'}
                </motion.button>
              </div>
              <p className="text-[10px] text-center text-black/20 font-black uppercase tracking-[0.4em] italic">End of Captured Session</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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
  const [transcriptionHistory, setTranscriptionHistory] = useState<ArchiveItem[]>([]);
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<ArchiveItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'settings' | 'history' | 'visual'>('live');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
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
              'microsoft \u0c24\u0c46\u0c32\u0c41\u0c17\u0c41',
              'telugu',
              'hindi'
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
    // Deeply strip markdown and normalize structure for better TTS flow
    const cleanText = text
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Keep link text
      .replace(/[*_~`]/g, '') // Remove all style markers
      .replace(/#+\s/g, '') // Remove headers
      .replace(/\n\s*[-*+]\s/g, '. ') // Bullets to sentence markers
      .replace(/\n\s*\d+\.\s/g, '. ') // Numbers to sentence markers
      .replace(/\n+/g, '. '); // Line breaks to markers
    
    // Split by punctuation and filter empty fragments
    return cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 1);
  };

  const stripMarkdown = (text: string) => {
    return text
      .replace(/[*_~`]/g, '') // Remove markers
      .replace(/#+\s/g, '')   // Remove headers
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .replace(/\n\s*[-*+]\s/g, '\n') // Remove list bullets
      .replace(/\n\s*\d+\.\s/g, '\n') // Remove numbered lists
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
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
    // Sentences are already cleaned in getSentences
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

  const playNeuralSpeech = async () => {
    if (!transcription) return;
    
    // Check if we already have an audio object playing
    if (audioRef.current) {
      if (isSpeaking) {
        audioRef.current.pause();
        setIsSpeaking(false);
      } else {
        audioRef.current.play();
        setIsSpeaking(true);
      }
      return;
    }

    // Check if the current last archive item matches this transcription and has a blob
    const existingItem = transcriptionHistory.find(i => i.text === transcription);
    
    if (existingItem?.generatedAudioBlob) {
      const url = URL.createObjectURL(existingItem.generatedAudioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      setIsSpeaking(true);
      audio.play();
      return;
    }

    // Otherwise generate on the fly
    setIsSpeaking(true);
    try {
      const base64Pcm = await textToSpeech(stripMarkdown(transcription), options.ttsVoice || 'Kore');
      if (base64Pcm) {
        const wavBlob = pcmToWavBlob(base64Pcm);
        const url = URL.createObjectURL(wavBlob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(url);
        };
        audio.play();
      }
    } catch (err: any) {
      console.error("Neural playback failed:", err);
      setError(`Neural playback unavailable: ${err.message || 'Server error'}`);
      setTimeout(() => setError(null), 5000);
      setIsSpeaking(false);
    }
  };

  const handlePlaybackToggle = () => {
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
      } else {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    } else {
      playNeuralSpeech();
    }
  };

  const mainSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds));
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
      const audioType = audioBlob.type || 'audio/webm';
      if (audioBlob.size < 1000) {
        throw new Error('Audio fragment too short. Please record for a few seconds.');
      }

      const base64 = await blobToBase64(audioBlob);
      const result = await transcribeAudio(base64, audioType, options);
      
      if (!result) {
        throw new Error('No transcription generated. The model returned an empty result.');
      }

      const cleanedText = result;
      
      // Auto-archive with metadata
      const newArchiveItem: ArchiveItem = {
        id: crypto.randomUUID(),
        text: cleanedText,
        timestamp: Date.now(),
        recordedAudioBlob: audioBlob,
        title: cleanedText.split('\n')[0].slice(0, 40).replace(/[#*]/g, '') || 'Neural Capture'
      };

      setTranscriptionHistory(prev => [newArchiveItem, ...prev].slice(0, 50));
      
      // Pre-generate high quality TTS in background for the archive
      if (options.enableTTS) {
        generateAndStoreAudio(newArchiveItem);
      }
      
      setTranscription(cleanedText);
      setArchived(true); // Temporary feedback
      setTimeout(() => setArchived(false), 2000);

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
    setTranscription(previous.text);
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
    
    const newArchiveItem: ArchiveItem = {
      id: crypto.randomUUID(),
      text: transcription,
      timestamp: Date.now(),
      recordedAudioBlob: audioBlob,
      title: transcription.split('\n')[0].slice(0, 40).replace(/[#*]/g, '') || 'Manual Archive'
    };

    setTranscriptionHistory(prev => {
      if (prev.some(item => item.text === transcription)) return prev;
      return [newArchiveItem, ...prev].slice(0, 50);
    });

    // Pre-generate audio for manually saved items too
    generateAndStoreAudio(newArchiveItem);

    setArchived(true);
    setTimeout(() => setArchived(false), 2000);
  };

  const generateAndStoreAudio = async (item: ArchiveItem) => {
    try {
      const cleanText = stripMarkdown(item.text);
      // Use the selected voice or Kore as premium default
      const base64Pcm = await textToSpeech(cleanText, options.ttsVoice || 'Kore');
      if (base64Pcm) {
        const wavBlob = pcmToWavBlob(base64Pcm);
        setTranscriptionHistory(prev => prev.map(i => 
          i.id === item.id ? { ...i, generatedAudioBlob: wavBlob } : i
        ));
        
        // Update selected item too so the player catches the change
        setSelectedArchiveItem(prev => {
          if (prev?.id === item.id) return { ...prev, generatedAudioBlob: wavBlob };
          return prev;
        });
      }
    } catch (err) {
      console.error("Background TTS generation failed:", err);
    }
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

  const handleDownloadImage = async () => {
    const isVisual = activeTab === 'visual';
    const hasContent = isVisual ? !!customText.trim() : !!transcription;
    if (!visualCardRef.current || !hasContent) return;
    
    setIsSharing(true);
    try {
      if (isVisual) {
        // Handle multi-page download
        const words = customText.split(/\s+/);
        const wordsPerPage = 350;
        const totalPages = Math.ceil(words.length / wordsPerPage) || 1;
        
        for (let i = 0; i < totalPages; i++) {
          setCurrentPageIndex(i);
          // Wait for state to propagate and DOM to update
          await new Promise(r => setTimeout(r, 100)); 
          
          if (!visualCardRef.current) continue;

          const dataUrl = await toPng(visualCardRef.current, {
            quality: 1.0,
            backgroundColor: '#F9F7F2',
            pixelRatio: 2, // Higher quality
          });
          
          const link = document.createElement('a');
          link.download = `vocalis-${customTitle || 'card'}-page-${i + 1}-of-${totalPages}.png`;
          link.href = dataUrl;
          link.click();
          
          // Minimal delay between batches
          await new Promise(r => setTimeout(r, 50));
        }
      } else {
        await new Promise(r => setTimeout(r, 100));
        const dataUrl = await toPng(visualCardRef.current, {
          quality: 1.0,
          backgroundColor: '#F9F7F2',
        });
        
        const link = document.createElement('a');
        link.download = `vocalis-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to generate image for download.');
    } finally {
      setIsSharing(false);
    }
  };

  const downloadGeneratedAudio = async () => {
    if (!transcription) return;
    
    setIsGeneratingAudio(true);
    try {
      const cleanText = stripMarkdown(transcription);
      // For now we use 'Kore' as a default high-quality voice, 
      // but Gemini 3.1 TTS might support more in the future.
      const base64Pcm = await textToSpeech(cleanText, 'Kore');
      if (base64Pcm) {
        const wavBlob = pcmToWavBlob(base64Pcm);
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vocalis-generated-${Date.now()}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Audio generation failed:', err);
      setError('Failed to generate audio for download.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const downloadAudio = () => {
    // This is for the ORIGINAL recorded audio
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocalis-recording-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

          <div className="flex-1">
            <div 
              className={`${options.fontFamily === 'sans' ? 'font-sans' : options.fontFamily === 'mono' ? 'font-mono' : 'font-serif'} text-black markdown-capture-container`}
              style={{ fontSize: `${options.fontSize}px` }}
            >
              <style dangerouslySetInnerHTML={{ __html: `
                .markdown-capture-container ul { list-style-type: disc !important; padding-left: 1.5em !important; margin-bottom: 1em !important; }
                .markdown-capture-container ol { list-style-type: decimal !important; padding-left: 1.5em !important; margin-bottom: 1em !important; }
                .markdown-capture-container li { display: list-item !important; margin-bottom: 0.5em !important; }
                .markdown-capture-container p { margin-bottom: 1.25em !important; line-height: 1.6 !important; }
                .markdown-capture-container h1, .markdown-capture-container h2, .markdown-capture-container h3 { 
                  font-weight: 600 !important; 
                  margin-top: 1.5em !important; 
                  margin-bottom: 0.75em !important; 
                  line-height: 1.2 !important;
                }
              `}} />
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeTab === 'visual' ? customText : transcription}
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
        <section className={`flex-1 flex flex-col bg-white/5 md:bg-white/10 relative overflow-y-auto pb-40 ${activeTab === 'live' || activeTab === 'visual' ? 'flex' : 'hidden'}`}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-start px-6 py-4 md:p-12 md:pt-8 max-w-4xl mx-auto w-full"
          >
            {activeTab === 'visual' && (
              <motion.div 
                key="visual-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-serif italic tracking-tight">Text to Visual Card</h2>
                  <p className="text-[11px] uppercase font-black text-black/30 tracking-widest">Format and export text as polished cards</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  <div className="space-y-6">
                    <div className="bg-white/40 backdrop-blur-xl border border-black/5 rounded-3xl p-6 shadow-xl shadow-black/5 space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-black text-black/30 tracking-widest block mb-2">Card Title</label>
                        <input 
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="Enter a title for your cards..."
                          className="w-full bg-black/[0.02] border border-black/[0.05] rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-black/10"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] uppercase font-black text-black/30 tracking-widest block mb-2">Input Content</label>
                        <textarea 
                          value={customText}
                          onChange={(e) => {
                            setCustomText(e.target.value);
                            setCurrentPageIndex(0);
                          }}
                          placeholder="Paste your text here..."
                          className="w-full h-80 bg-black/[0.02] border border-black/[0.05] rounded-2xl p-6 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-black/10 resize-none custom-scrollbar"
                        />
                        <div className="flex justify-between items-center mt-4">
                          <div className="flex gap-4">
                            <span className="text-[9px] font-black text-black/20 uppercase tracking-widest">{customText.split(/\s+/).filter(Boolean).length} Words</span>
                            <span className="text-[9px] font-black text-black/20 uppercase tracking-widest">{Math.ceil(customText.split(/\s+/).filter(Boolean).length / 350) || 1} Pages</span>
                          </div>
                          <button 
                            onClick={() => {
                              setCustomText('');
                              setCurrentPageIndex(0);
                            }}
                            className="text-[9px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-widest transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDownloadImage}
                        disabled={!customText.trim() || isSharing}
                        className="flex-1 px-4 py-5 bg-black text-white text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 rounded-xl shadow-xl shadow-black/10 disabled:opacity-30"
                      >
                        {isSharing ? <RefreshCcw size={18} className="animate-spin" /> : <Download size={18} />}
                        {isSharing ? 'Generating...' : 'Download All Cards'}
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                           if (!customText.trim()) return;
                           setIsGeneratingAudio(true);
                           try {
                             const base64Pcm = await textToSpeech(customText, options.ttsVoice || 'Kore');
                             if (base64Pcm) {
                               const wavBlob = pcmToWavBlob(base64Pcm);
                               const url = URL.createObjectURL(wavBlob);
                               const link = document.createElement('a');
                               link.href = url;
                               link.download = `vocalis-speech-${Date.now()}.wav`;
                               link.click();
                               URL.revokeObjectURL(url);
                             }
                           } catch (err) {
                             console.error(err);
                           } finally {
                             setIsGeneratingAudio(false);
                           }
                        }}
                        disabled={!customText.trim() || isGeneratingAudio}
                        className="flex-1 px-4 py-5 border border-black text-black text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 rounded-xl hover:bg-black/5 disabled:opacity-30"
                      >
                         {isGeneratingAudio ? <RefreshCcw size={18} className="animate-spin" /> : <Volume2 size={18} />}
                         TTS Generation
                      </motion.button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                       <label className="text-[10px] uppercase font-black text-black/30 tracking-widest block">Live Preview</label>
                       {customText.trim() && (
                         <div className="flex items-center gap-4">
                            <button 
                              onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                              disabled={currentPageIndex === 0}
                              className="text-black/30 hover:text-black disabled:opacity-10 transition-colors"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                              {currentPageIndex + 1} / {Math.ceil(customText.split(/\s+/).filter(Boolean).length / 350) || 1}
                            </span>
                            <button 
                              onClick={() => setCurrentPageIndex(p => Math.min(Math.ceil(customText.split(/\s+/).filter(Boolean).length / 350) - 1, p + 1))}
                              disabled={currentPageIndex >= (Math.ceil(customText.split(/\s+/).filter(Boolean).length / 350) - 1)}
                              className="text-black/30 hover:text-black disabled:opacity-10 transition-colors"
                            >
                              <ChevronRight size={16} />
                            </button>
                         </div>
                       )}
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-4 bg-gradient-to-tr from-black/5 to-transparent rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div 
                        ref={visualCardRef}
                        className="bg-[#F9F7F2] border border-black shadow-2xl rounded-sm p-10 min-h-[500px] relative overflow-hidden flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-8">
                          <VocalisLogo className="w-8 h-8 text-black" />
                          <div className="flex flex-col items-end">
                            <div className="text-[8px] uppercase font-black tracking-[0.4em] text-black/20 italic">Visual Render v1</div>
                            <div className="text-[7px] uppercase font-black tracking-widest text-black/10 mt-1">
                              Page {currentPageIndex + 1} of {Math.ceil(customText.split(/\s+/).filter(Boolean).length / 350) || 1}
                            </div>
                          </div>
                        </div>

                        {customTitle && (
                          <h3 className="text-xl font-serif italic mb-6 border-b border-black/5 pb-4 opacity-80">{customTitle}</h3>
                        )}

                        <div 
                          className={`flex-1 ${options.fontFamily === 'sans' ? 'font-sans' : options.fontFamily === 'mono' ? 'font-mono' : 'font-serif'} whitespace-pre-wrap break-words italic leading-relaxed text-justify`}
                          style={{ fontSize: `${options.fontSize}px` }}
                        >
                          {customText ? customText.split(/\s+/).slice(currentPageIndex * 350, (currentPageIndex + 1) * 350).join(' ') : 'Your content will appear here...'}
                        </div>

                        <div className="mt-12 pt-8 border-t border-black/10 flex justify-between items-end opacity-40">
                           <div className="text-[9px] font-serif italic">{new Date().toLocaleDateString()}</div>
                           <div className="text-[8px] uppercase font-black tracking-widest">Shared via Vocalis</div>
                        </div>
                        
                        <div 
                          className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-multiply"
                          style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/felt.png")' }}
                        />
                      </div>
                    </div>

                    <div className="bg-black/[0.02] border border-black/5 rounded-3xl p-6 space-y-6">
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] uppercase font-black text-black/40 tracking-widest">Text Style</span>
                         <div className="flex bg-black/[0.03] p-0.5 rounded-lg border border-black/[0.05]">
                          {['serif', 'sans', 'mono'].map((f) => (
                            <button
                              key={f}
                              onClick={() => setOptions({...options, fontFamily: f as any})}
                              className={`px-3 py-1 text-[8px] uppercase font-black tracking-widest rounded-md transition-all ${options.fontFamily === f ? 'bg-white text-black shadow-sm' : 'text-black/30 hover:text-black/50'}`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                       </div>

                       <div className="space-y-2">
                         <div className="flex justify-between items-center text-[10px] font-black text-black/40 uppercase tracking-widest">
                           <span>Scale</span>
                           <span>{options.fontSize}px</span>
                         </div>
                         <input 
                            type="range" 
                            min="12" 
                            max="32" 
                            value={options.fontSize} 
                            onChange={(e) => setOptions({...options, fontSize: parseInt(e.target.value)})}
                            className="custom-range w-full"
                          />
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {activeTab === 'live' && (
                transcription ? (
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
                        onClick={handleDownloadImage}
                        disabled={isSharing}
                        className={`flex-1 px-4 py-5 border text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all rounded-xl md:rounded-sm border-black text-black hover:bg-black/5 hover:scale-[1.01] ${isSharing ? 'opacity-50' : ''}`}
                      >
                        {isSharing ? <RefreshCcw size={18} className="animate-spin" /> : <Download size={18} />}
                        {isSharing ? 'Generating...' : 'Download Image'}
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
                        onClick={downloadGeneratedAudio}
                        disabled={isGeneratingAudio}
                        className={`flex-1 px-4 py-5 border border-black/10 text-[11px] uppercase font-black tracking-widest flex items-center justify-center gap-2 hover:border-black transition-all rounded-xl md:rounded-sm hover:bg-black/5 ${isGeneratingAudio ? 'opacity-50' : ''}`}
                      >
                        {isGeneratingAudio ? <RefreshCcw size={18} className="animate-spin" /> : <Volume2 size={18} />}
                        {isGeneratingAudio ? 'Generating...' : 'Download Audio'}
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
                        <div className="flex items-center justify-center gap-4 sm:gap-8 pb-1">
                          <button 
                            onClick={() => mainSkip(-15)}
                            className="text-black/15 hover:text-black transition-all hover:scale-110 active:scale-95 shrink-0"
                            title="Skip back 15s"
                          >
                            <RotateCcw size={18} />
                          </button>

                          <div className="flex items-center gap-3 sm:gap-6">
                            <button 
                              onClick={skipBackward}
                              disabled={currentSentenceIndex <= 0}
                              className="text-black/30 hover:text-black transition-all disabled:opacity-5 hover:scale-110 active:scale-90 shrink-0"
                            >
                              <SkipBack size={22} fill="currentColor" />
                            </button>
                            
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              animate={isSpeaking ? { 
                                boxShadow: ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(0,0,0,0.08)", "0px 0px 0px rgba(0,0,0,0)"]
                              } : {}}
                              transition={{ repeat: Infinity, duration: 2 }}
                              onClick={handlePlaybackToggle}
                              className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white shadow-2xl shadow-black/20 shrink-0 active:scale-95"
                            >
                              {isSpeaking ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                            </motion.button>

                            <button 
                              onClick={skipForward}
                              disabled={currentSentenceIndex >= getSentences(transcription).length - 1}
                              className="text-black/30 hover:text-black transition-all disabled:opacity-5 hover:scale-110 active:scale-90 shrink-0"
                            >
                              <SkipForward size={22} fill="currentColor" />
                            </button>
                          </div>

                          <button 
                            onClick={() => mainSkip(15)}
                            className="text-black/15 hover:text-black transition-all hover:scale-110 active:scale-95 shrink-0"
                            title="Skip forward 15s"
                          >
                            <RotateCw size={18} />
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
              )
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

        {/* History Tab for Mobile & Desktop */}
        <aside className={`${activeTab === 'history' ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r border-black/10 flex-col bg-white/20 overflow-y-auto custom-scrollbar relative z-[60]`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 p-10 pb-32 flex flex-col"
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
             <div className="grid grid-cols-1 gap-4">
               {transcriptionHistory.map((item, i) => (
                 <motion.div 
                   key={item.id} 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.05 }}
                   onClick={() => { 
                     setSelectedArchiveItem(item); 
                     setIsPlayerOpen(true); 
                   }}
                   className="group relative p-6 bg-white border border-black/10 rounded-3xl shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer overflow-hidden text-left"
                 >
                   <div className="absolute top-0 left-0 w-1 h-full bg-black/10 group-hover:bg-black transition-colors" />
                   <div className="flex justify-between items-start mb-3">
                     <div className="flex flex-col">
                       <span className="text-[9px] uppercase font-black tracking-widest text-black/40 mb-1">
                         {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                       </span>
                       <h3 className="text-base font-medium font-serif text-black leading-tight line-clamp-1 group-hover:text-black transition-colors">{item.title}</h3>
                     </div>
                     <div className="p-2.5 bg-black/5 rounded-full group-hover:bg-black group-hover:text-white transition-all">
                       <Play size={12} fill="currentColor" />
                     </div>
                   </div>
                   <p className="text-[11px] font-serif italic text-black/50 line-clamp-2 leading-relaxed">
                     {item.text.replace(/[#*]/g, '').slice(0, 100)}...
                   </p>
                 </motion.div>
               ))}
             </div>
           ) : (
             <p className="text-sm font-serif italic text-black/30">No buffered fragments.</p>
           )}
          </motion.div>
        </aside>
      </div>

      <AnimatePresence>
        {isPlayerOpen && selectedArchiveItem && (
          <ImmersivePlayer 
            item={selectedArchiveItem} 
            onClose={() => setIsPlayerOpen(false)} 
            options={options}
            setTranscriptionHistory={setTranscriptionHistory}
            setSelectedArchiveItem={setSelectedArchiveItem}
          />
        )}
      </AnimatePresence>

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
            { id: 'visual', label: 'Visual', icon: BookOpen },
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
