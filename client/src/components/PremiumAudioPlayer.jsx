import React, { useRef, useEffect, useState } from 'react';

/**
 * PremiumAudioPlayer
 * A clean, professional audio visualizer and player with a transparent background.
 * Uses a smooth, real-time procedural frequency animation that responds to play/pause triggers.
 * Bypasses CORS playback restrictions by utilizing native HTML5 streaming.
 */
export default function PremiumAudioPlayer({ src }) {
	const audioRef = useRef(null);
	const canvasRef = useRef(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isBuffering, setIsBuffering] = useState(false);
	const currentHeightsRef = useRef(new Array(48).fill(4));
	const rafRef = useRef(null);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handlePlay = () => setIsPlaying(true);
		const handlePause = () => setIsPlaying(false);
		const handleEnded = () => setIsPlaying(false);
		const handleWaiting = () => setIsBuffering(true);
		const handlePlaying = () => {
			setIsPlaying(true);
			setIsBuffering(false);
		};
		const handleSeeking = () => setIsBuffering(true);
		const handleSeeked = () => setIsBuffering(false);

		audio.addEventListener('play', handlePlay);
		audio.addEventListener('pause', handlePause);
		audio.addEventListener('ended', handleEnded);
		audio.addEventListener('waiting', handleWaiting);
		audio.addEventListener('playing', handlePlaying);
		audio.addEventListener('seeking', handleSeeking);
		audio.addEventListener('seeked', handleSeeked);

		return () => {
			audio.removeEventListener('play', handlePlay);
			audio.removeEventListener('pause', handlePause);
			audio.removeEventListener('ended', handleEnded);
			audio.removeEventListener('waiting', handleWaiting);
			audio.removeEventListener('playing', handlePlaying);
			audio.removeEventListener('seeking', handleSeeking);
			audio.removeEventListener('seeked', handleSeeked);
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, []);

	// Waveform dynamic animation loop
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		const numBars = 48;

		const draw = () => {
			rafRef.current = requestAnimationFrame(draw);

			const width = canvas.width;
			const height = canvas.height;

			// Clear with absolute transparent background
			ctx.clearRect(0, 0, width, height);

			const time = Date.now() * 0.004;

			if (isPlaying && !isBuffering) {
				for (let i = 0; i < numBars; i++) {
					// Simulate frequency bands (bass/mids/treble)
					const bass = Math.sin(time * 1.5 + i * 0.12) * 20 + 25;
					const mid = Math.sin(time * 3.0 - i * 0.2) * 12 + 12;
					const treble = Math.sin(time * 7.0 + i * 0.4) * 6 + 6;

					// Slope: bass has higher peaks, treble falls off gradually
					const slope = Math.pow(Math.max(0.25, 1 - (i / numBars)), 0.7);
					let targetHeight = (bass + mid + treble) * slope * 0.9;

					// Add natural micro-jitters
					if (Math.random() > 0.85) {
						targetHeight += Math.random() * 8;
					}

					targetHeight = Math.max(4, Math.min(height - 4, targetHeight));

					// Interpolate heights to prevent jitter
					currentHeightsRef.current[i] = currentHeightsRef.current[i] * 0.55 + targetHeight * 0.45;
				}
			} else if (isBuffering) {
				// Buffer animation: slow, breathing indicator wave
				const breath = Math.sin(time * 2.0) * 3 + 6;
				for (let i = 0; i < numBars; i++) {
					const wave = Math.sin(time * 0.5 + i * 0.15) * 2 + breath;
					currentHeightsRef.current[i] = currentHeightsRef.current[i] * 0.75 + wave * 0.25;
				}
			} else {
				// Smoothly decay all bars down to baseline when paused
				for (let i = 0; i < numBars; i++) {
					currentHeightsRef.current[i] = Math.max(4, currentHeightsRef.current[i] * 0.85 - 0.2);
				}
			}

			// Render equalizer bars
			const barWidth = (width / numBars) * 0.65;
			const gap = (width / numBars) * 0.35;
			let x = gap / 2;

			const gradient = ctx.createLinearGradient(0, height, 0, 0);
			gradient.addColorStop(0, '#818cf8'); // Indigo-400
			gradient.addColorStop(1, '#c084fc'); // Purple-400

			for (let i = 0; i < numBars; i++) {
				const barHeight = currentHeightsRef.current[i];
				const y = height - barHeight;
				const radius = barWidth / 2;

				ctx.beginPath();
				ctx.fillStyle = gradient;
				if (ctx.roundRect) {
					ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
				} else {
					ctx.rect(x, y, barWidth, barHeight);
				}
				ctx.fill();

				x += barWidth + gap;
			}
		};

		draw();

		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [isPlaying, isBuffering]);

	return (
		<div className="relative p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center gap-4 shadow-sm w-full">
			{/* Real-time transparent visualizer */}
			<div className="w-full h-12 flex items-end opacity-85 select-none pointer-events-none">
				<canvas
					ref={canvasRef}
					width={600}
					height={72}
					className="w-full h-full"
				/>
			</div>

			{/* Browser-native audio controls (removes crossOrigin settings to ensure full audio playback compatibility) */}
			<audio
				ref={audioRef}
				src={src}
				controls
				className="w-full"
			/>
		</div>
	);
}
