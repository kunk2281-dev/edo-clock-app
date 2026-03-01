import React, { useState, useEffect, useRef, useReducer } from 'react';
import SunCalc from 'suncalc';

/**
 * 江戸時間（不定時法）Yuji Syuku 縦書き対応版
 */
const EdoClockFinal = () => {
  const NIHONBASHI = { lat: 35.6839, lng: 139.7745 };
  
  // State管理
  const [edoTime, setEdoTime] = useState(null);
  const [coords, setCoords] = useState(NIHONBASHI); 
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const prevTokiName = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // 1. Google Fonts の読み込みを動的に追加
  useEffect(() => {
    if (!document.getElementById('google-font-yuji')) {
      const link = document.createElement('link');
      link.id = 'google-font-yuji';
      link.href = "https://fonts.googleapis.com/css2?family=Yuji+Syuku&display=swap";
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    audioRef.current = new Audio('/sounds/Bonsho03-3(Far-High).mp3'); 
    audioRef.current.volume = 0.6;
  }, []);

  const playBell = () => {
    if (audioRef.current && isAudioEnabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Audio Error:", e));
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
    const index = Math.min(Math.floor(elapsed / tokiLength), 5);
    const currentName = names[index] || "刻の境";
    const progress = (elapsed % tokiLength) / tokiLength * 100;

    if (prevTokiName.current && prevTokiName.current !== currentName) {
      playBell();
    }
    prevTokiName.current = currentName;

    return {
      name: currentName,
      zodiac: zodiacs[index] || "不明",
      progress: progress,
      isDay: isDay,
      nextTokiIn: Math.max(0, Math.round((tokiLength - (elapsed % tokiLength)) / 60000))
    };
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null,
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now);
      setEdoTime(() => calculateEdoTime(now, coords.lat, coords.lng));
      forceUpdate();
    };
    update();
    timerRef.current = setInterval(update, 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        update();
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(update, 1000);
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

  if (!isAudioEnabled) {
    return (
      <div style={fullScreenCenter}>
        <h1 style={{ color: '#d9333f', fontFamily: '"Yuji Syuku", serif', fontSize: '2.5rem' }}>和時計</h1>
        <button onClick={() => { setIsAudioEnabled(true); playBell(); }} style={startButtonStyle}>
          いざ、江戸時間へ
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle(edoTime?.isDay)}>
      <header style={headerStyle}>
        {edoTime?.isDay ? "☀️ 陽の刻（昼）" : "🌙 陰の刻（夜）"}
      </header>

      <main style={mainStyle}>
        <div style={clockWrapperStyle}>
          <svg viewBox="0 0 100 100" style={svgStyle}>
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="0.5" />
            <circle 
              cx="50" cy="50" r="46" fill="none" stroke="#d9333f" strokeWidth="2.5" 
              strokeDasharray="289" 
              strokeDashoffset={289 - (289 * (edoTime?.progress || 0) / 100)} 
              style={{ transition: 'stroke-dashoffset 1s linear' }}
              strokeLinecap="round"
            />
          </svg>
          
          <div style={tokiOverlayStyle}>
            {/* 縦書き・Yuji Syuku適用のメイン文字 */}
            <div style={tokiNameStyle}>{edoTime?.name}</div>
            <div style={zodiacStyle}>
              {edoTime?.zodiac}の刻
            </div>
          </div>
        </div>

        <div style={infoPanelStyle}>
          <p style={{ fontSize: '1.1rem', letterSpacing: '1px' }}>次の一刻まで 約 {edoTime?.nextTokiIn} 分</p>
          <p style={{ opacity: 0.6, fontSize: '0.9rem', marginTop: '10px', fontWeight: 'bold' }}>
             {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          
          <button onClick={shareOnX} style={shareButtonStyle}>
            𝕏 で刻を伝える
          </button>
        </div>
      </main>

      <footer style={footerStyle}>
        基準: {coords.lat === NIHONBASHI.lat ? "江戸（日本橋）" : "現在地"}
      </footer>
    </div>
  );
};

// --- スタイル定義 ---
const fullScreenCenter = {
 height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
 alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f0',
 color: '#1a1a1a', fontFamily: '"Yuji Syuku", serif', textAlign: 'center', padding: '20px', boxSizing: 'border-box'
};

const startButtonStyle = {
 marginTop: '2rem', padding: '12px 40px', fontSize: '1.2rem',
 backgroundColor: 'transparent', color: '#d9333f', border: '2px solid #d9333f',
 borderRadius: '4px', cursor: 'pointer', fontFamily: '"Yuji Syuku", serif'
};

const containerStyle = (isDay) => ({
 backgroundColor: isDay ? '#f5f5f0' : '#0d0d0d',
 color: isDay ? '#1a1a1a' : '#f5f5f0',
 height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
 fontFamily: '"Yuji Syuku", serif', transition: 'background-color 1s ease',
 overflow: 'hidden', boxSizing: 'border-box'
});

const headerStyle = { padding: '15px', textAlign: 'center', fontSize: '0.9rem', letterSpacing: '3px', flexShrink: 0 };
const mainStyle = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px' };

const clockWrapperStyle = {
 position: 'relative',
 width: 'min(75vw, 55vh)', // 円を少し大きく調整
 height: 'min(75vw, 55vh)',
 margin: '0 auto'
};

const svgStyle = { transform: 'rotate(-90deg)', width: '100%', height: '100%' };

const tokiOverlayStyle = {
 position: 'absolute',
 top: '50%', left: '50%',
 transform: 'translate(-50%, -50%)',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 width: '80%' // 円の内側に収めるためのガード
};

const tokiNameStyle = {
 // 縦書き設定
 writingMode: 'vertical-rl',
 textOrientation: 'upright',
 // 円からはみ出さない動的なフォントサイズ
 fontSize: 'clamp(2rem, 18vw, 5rem)', 
 fontWeight: 'normal', // Yuji Syukuはnormalが一番綺麗です
 color: '#d9333f',
 lineHeight: '1.1',
 letterSpacing: '0.05em',
 whiteSpace: 'nowrap'
};

const zodiacStyle = {
 fontSize: 'clamp(0.8rem, 4vw, 1.2rem)',
 color: '#c4a358',
 marginTop: '10px',
 writingMode: 'horizontal-tb' // 十二支は横書きでバランスをとる
};

const infoPanelStyle = { textAlign: 'center', marginTop: '1.5rem', zIndex: 10 };
const shareButtonStyle = {
 marginTop: '15px', padding: '10px 25px', borderRadius: '25px', border: 'none',
 backgroundColor: '#333', color: 'white', cursor: 'pointer', fontSize: '0.8rem', zIndex: 100
};
const footerStyle = { padding: '15px', textAlign: 'center', fontSize: '0.7rem', opacity: 0.6, flexShrink: 0 };

export default EdoClockFinal;