import React, { useState, useEffect, useRef, useReducer } from 'react';
import SunCalc from 'suncalc';

/**
 * 江戸時間（不定時法）進捗レール可視化・スマホ最適化版
 * LINEシェアボタン追加 Ver.
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

  // シェア用テキスト生成
  const getShareText = () => {
    const timeStr = currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return `【江戸時間】今は「${edoTime?.name} (${edoTime?.zodiac}の刻)」。\n現代時刻で ${timeStr} 頃です。`;
  };

  const shareOnX = (e) => {
    e.stopPropagation();
    const text = getShareText();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const shareOnLine = (e) => {
    e.stopPropagation();
    const text = getShareText();
    // LINEはテキストとURLを繋げて送るのが一般的
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
  };

  // 指定された2色に切り替え
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
    <div style={containerStyle(colors.bg, colors.text)}>
      <header style={headerStyle}>
        {edoTime?.isDay ? "☀️ 陽の刻（昼）" : "🌙 陰の刻（夜）"}
      </header>

      <main style={mainStyle}>
        <div style={clockWrapperStyle}>
          <svg viewBox="0 0 100 100" style={svgStyle}>
            {/* 背景の薄い円（レール） */}
            <circle
              cx="50" cy="50" r="46"
              fill="none"
              stroke={colors.accent