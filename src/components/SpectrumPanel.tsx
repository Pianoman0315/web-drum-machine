import { useEffect, useRef } from "react";

type SpectrumPanelProps = {
  getValues: () => Float32Array | number[];
};

export function SpectrumPanel({ getValues }: SpectrumPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frameId = 0;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pixelRatio = window.devicePixelRatio || 1;
      const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
      const targetHeight = Math.max(1, Math.floor(height * pixelRatio));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(255, 214, 148, 0.96)");
      gradient.addColorStop(0.58, "rgba(229, 123, 44, 0.88)");
      gradient.addColorStop(1, "rgba(92, 49, 25, 0.82)");

      context.fillStyle = "rgba(10, 9, 8, 0.62)";
      context.fillRect(0, 0, width, height);

      const values = getValues?.();
      const source = values ? Array.from(values).slice(2, 34) : [];
      const barCount = 24;
      const gap = 4;
      const barWidth = Math.max(3, (width - gap * (barCount - 1)) / barCount);

      for (let index = 0; index < barCount; index += 1) {
        const rawValue = source[index] ?? -120;
        const normalized = Math.max(0.04, Math.min(1, (rawValue + 100) / 80));
        const barHeight = normalized * (height - 10);
        const x = index * (barWidth + gap);
        const y = height - barHeight;

        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, 5);
        context.fill();
      }

      frameId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [getValues]);

  return <canvas ref={canvasRef} className="spectrum-canvas" aria-label="Drum audio spectrum" />;
}
