import React, { useState, useEffect, useRef, useReducer } from 'react';
import SunCalc from 'suncalc';

/**
 * 江戸時間（不定時法）進捗レール可視化・スマホ完全最適化版
 */
const EdoClockFinal = () => {
  const NIHONBASHI = { lat: 35.6839, lng: 139.7745 };
  
  const [edoTime, setEdoTime] = useState(null);
  const [coords, setCoords] = useState(NIHONBASHI); 
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const prevTokiName = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById('google-font-yuji')) {
      const link = document.createElement('link');
      link.id = 'google-font-yuji';
      link.href = "https://fonts.googleapis.com/css2?family=Yuji+Syuku&display=swap";
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    // 音源のプリロード設定
    const audio = new Audio('https://otologic.jp/free/se/bin/Bonsho03-3(Far-High).mp3'); 
    audio.volume = 0.6;
    audio.preload = "auto";
    audioRef.current = audio;
  }, []);

  const playBell = () => {
    if (audioRef.current && isAudioEnabled) {
      audioRef.current.currentTime = 0;
      // スマホの省エネ制限対策としてPromiseをハンドル
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.log("再生がブロックされました。画面をタップしてください。"));
      }
    }
  };

  const calculateEdoTime = (date, lat, lng) => {
    const times = SunCalc.getTimes(date, lat, lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;
    const isDay = date >= sunrise && date < sunset;
    
    let periodStart, periodEnd, names, zodiacs;

    if (isDay) {
      periodStart = sunrise;
      periodEnd = sunset;
      names = ["明け六つ", "明け五つ", "明け四つ", "昼九つ", "昼八つ", "昼七つ"];
      zodiacs = ["卯", "辰", "巳", "午", "未", "申"];
    } else {
      periodStart = date < sunrise ? sunset - 86400000 : sunset;
      const nextDay = new Date(date.getTime() + 86400000);
      periodEnd = date < sunrise ? sunrise : SunCalc.getTimes(nextDay, lat, lng).sunrise;
      names = ["暮れ六つ", "暮れ五つ", "暮れ四つ", "夜九つ", "夜八つ", "夜七つ"];
      zodiacs = ["酉", "戌", "亥", "子", "丑", "寅"];
    }

    const tokiLength = (periodEnd - periodStart) / 6;
    const elapsed = date - periodStart;
    const index = Math.max(0, Math.min(Math.floor(elapsed / tokiLength), 5));
    const currentName = names[index];
    const progress = (elapsed % tokiLength) / tokiLength * 100;

    // 刻が変わった瞬間の判定（初回実行時は鳴らさない）
    if (prevTokiName.current && prevTokiName.current !== currentName) {
      playBell();
    }
    prevTokiName.current = currentName;

    return {
      name: currentName,
      zodiac: zodiacs[index],
      progress: progress,
      isDay: isDay,
      nextTokiIn: Math.max(0, Math.round((tokiLength - (elapsed % tokiLength)) / 60000))
    };
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null, { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now);
      setEdoTime(calculateEdoTime(now, coords.lat, coords.lng));
      forceUpdate();
    };
    
    update();
    timerRef.current = setInterval(update, 1000);

    // スマホのバックグラウンド復帰対策
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        update(); 
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [coords.lat, coords.lng, isAudioEnabled]);

  const shareOnX = (e) => {
    e.stopPropagation();
    const text = `【江戸時間】今は「${edoTime?.name}」。\n ${currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 頃。`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const colors = edoTime?.isDay 
    ? { bg: '#F9F9F9', text: '#333333', accent: '#D72638' } 
    : { bg: '#1A1A1B', text: '#C0C0C0', accent: '#FFD700' };

  if (!isAudioEnabled) {
    return (
      <div style={fullScreenCenter}>
        <h1 style={{ color: '#D72638', fontFamily: '"Yuji Syuku", serif', fontSize: '2.5rem' }}>和時計</h1>
        <button onClick={() => { setIsAudioEnabled(true); playBell(); }} style={startButtonStyle}>
          いざ、江戸時間へ
        </button>
      </div>
    );
  }

  return (
    <div 
      style={containerStyle(colors.bg, colors.text)} 
      onClick={() => { if(isAudioEnabled) audioRef.current?.play().then(() => audioRef.current.pause()); }}
    >
      <header style={headerStyle}>
        {edoTime?.isDay ? "☀️ 陽の刻（昼）" : "🌙 陰の刻（夜）"}
      </header>

      <main style={mainStyle}>
        <div style={clockWrapperStyle}>
          <svg viewBox="0 0 100 100" style={svgStyle}>
            <circle cx="50" cy="50" r="46" fill="none" stroke={colors.accent} strokeWidth="1.5" opacity="0.15" />
            <circle 
              cx="50" cy="50" r="46" 
              fill="none" 
              stroke={colors.accent} 
              strokeWidth="2.5" 
              strokeDasharray="289" 
              strokeDashoffset={289 - (289 * (edoTime?.progress || 0) / 100)} 
              style={{ transition: 'stroke-dashoffset 1s linear' }}
              strokeLinecap="round"
            />
          </svg>
          
          <div style={tokiOverlayStyle}>
            <div style={{...tokiNameStyle, color: colors.accent}}>{edoTime?.name}</div>
            <div style={{...zodiacStyle, color: colors.text}}>{edoTime?.zodiac}の刻</div>
          </div>
        </div>

        <div style={infoPanelStyle}>
          <p style={{ fontSize: '0.9rem', letterSpacing: '1px', margin: '0' }}>次の一刻まで 約 {edoTime?.nextTokiIn} 分</p>
          <p style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: '5px', fontWeight: 'bold' }}>
             {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <button onClick={shareOnX} style={{...shareButtonStyle, backgroundColor: colors.text, color: colors.bg}}>
            𝕏 で刻を伝える
          </button>
        </div>
      </main>

      <footer style={footerStyle}>
        <div>基準: {coords.lat === NIHONBASHI.lat ? "江戸（日本橋）" : "現在地"}</div>
        <div style={{ marginTop: '5px' }}>効果音提供 OtoLogic</div>
      </footer>
    </div>
  );
};

// --- スタイル定義（スマホ横向き対応） ---
const fullScreenCenter = {
  height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9',
  fontFamily: '"Yuji Syuku", serif', textAlign: 'center', padding: '20px', boxSizing: 'border-box'
};

const startButtonStyle = {
  marginTop: '2rem', padding: '12px 40px', fontSize: '1.2rem',
  backgroundColor: 'transparent', color: '#D72638', border: '2px solid #D72638',
  borderRadius: '4px', cursor: 'pointer', fontFamily: '"Yuji Syuku", serif'
};

const containerStyle = (bg, text) => ({
  backgroundColor: bg, color: text,
  height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
  fontFamily: '"Yuji Syuku", serif', transition: 'background-color 1.5s ease',
  overflow: 'hidden', boxSizing: 'border-box'
});

const headerStyle = { padding: '10px', textAlign: 'center', fontSize: 'min(3vw, 0.8rem)', flexShrink: 0 };

const mainStyle = { 
  flex: 1, display: 'flex', flexDirection: 'column', 
  alignItems: 'center', justifyContent: 'center', padding: '10px', overflow: 'hidden'
};

const clockWrapperStyle = {
  position: 'relative',
  width: 'min(70vw, 55vh)', // 画面の高さが低い横向きでも収まるように調整
  height: 'min(70vw, 55vh)',
  aspectRatio: '1 / 1'
};

const svgStyle = { transform: 'rotate(-90deg)', width: '100%', height: '100%' };

const tokiOverlayStyle = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
};

const tokiNameStyle = {
  writingMode: 'vertical-rl',
  textOrientation: 'upright',
  // 文字サイズを「円の大きさ（vh/vw）」に追従させる
  fontSize: 'clamp(1.2rem, 12vh, 3.5rem)', 
  fontWeight: 'normal',
  lineHeight: '1.1',
  whiteSpace: 'nowrap'
};

const zodiacStyle = { fontSize: 'clamp(0.7rem, 3vh, 1rem)', marginTop: '5px', opacity: 0.8 };

const infoPanelStyle = { textAlign: 'center', marginTop: '1rem', flexShrink: 0 };
const shareButtonStyle = {
  marginTop: '10px', padding: '6px 20px', borderRadius: '25px', border: 'none',
  cursor: 'pointer', fontSize: '0.7rem'
};
const footerStyle = { padding: '10px', textAlign: 'center', fontSize: '0.6rem', opacity: 0.6, flexShrink: 0 };

export default EdoClockFinal;