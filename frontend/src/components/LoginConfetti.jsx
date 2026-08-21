import { useEffect, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { consumeConfetti } from '../utils/confetti';

export default function LoginConfetti() {
  const [show, setShow] = useState(false);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const hideTimer = useRef(null);

  useEffect(() => {
    const trigger = () => {
      if (!consumeConfetti()) return;
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setShow(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShow(false), 4500);
    };
    window.addEventListener('ades-confetti', trigger);
    return () => {
      window.removeEventListener('ades-confetti', trigger);
      clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!show) return undefined;
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [show]);

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2000 }}>
      <Confetti
        width={size.width}
        height={size.height}
        numberOfPieces={220}
        recycle={false}
        gravity={0.25}
        colors={['#F5B301', '#FFE08A', '#2E7D32', '#3FA34A', '#FFFFFF']}
      />
    </div>
  );
}
