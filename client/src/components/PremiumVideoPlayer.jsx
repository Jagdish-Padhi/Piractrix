import React, { useRef, useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

/**
 * PremiumVideoPlayer
 * A robust video player wrapper that implements inline HTML5 playback with native controls,
 * managed buffering overlays, and fallbacks for connection/playback errors.
 */
export default function PremiumVideoPlayer({ src, poster }) {
	const videoRef = useRef(null);
	const [isBuffering, setIsBuffering] = useState(false);
	const [hasError, setHasError] = useState(false);

	// Reset states when the source URL changes
	useEffect(() => {
		Promise.resolve().then(() => {
			setIsBuffering(false);
			setHasError(false);
		});
	}, [src]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const handleWaiting = () => setIsBuffering(true);
		const handlePlaying = () => {
			setIsBuffering(false);
			setHasError(false);
		};
		const handleSeeking = () => setIsBuffering(true);
		const handleSeeked = () => setIsBuffering(false);
		const handleError = () => {
			if (video && video.error) {
				// Ignore abort error (code 1, MEDIA_ERR_ABORTED) which fires during clean reloads/src changes
				if (video.error.code !== 1) {
					console.warn('Video node playback error triggered:', video.error.code);
					setHasError(true);
					setIsBuffering(false);
				}
			}
		};

		// Event bindings
		video.addEventListener('waiting', handleWaiting);
		video.addEventListener('playing', handlePlaying);
		video.addEventListener('seeking', handleSeeking);
		video.addEventListener('seeked', handleSeeked);
		video.addEventListener('error', handleError);

		return () => {
			video.removeEventListener('waiting', handleWaiting);
			video.removeEventListener('playing', handlePlaying);
			video.removeEventListener('seeking', handleSeeking);
			video.removeEventListener('seeked', handleSeeked);
			video.removeEventListener('error', handleError);
		};
	}, [src]);

	return (
		<div className="relative w-full h-full min-h-[240px] max-h-[300px] flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
			<video
				ref={videoRef}
				src={src}
				poster={poster}
				controls
				playsInline
				className="w-full h-full object-contain max-h-[300px]"
			/>

			{/* Glassmorphic Buffering Overlay (pointer-events-none ensures controls are not blocked) */}
			{isBuffering && !hasError && (
				<div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none transition-all duration-300">
					<div className="p-3 rounded-full bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-center">
						<Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
					</div>
				</div>
			)}

			{/* Clean Playback Error Frame */}
			{hasError && (
				<div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-4 transition-all duration-300">
					<AlertTriangle className="w-10 h-10 text-red-500 mb-2 animate-pulse" />
					<h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
						Signal Interruption
					</h5>
					<p className="text-[10px] text-slate-400 mt-1 max-w-[240px] leading-relaxed">
						Failed to establish secure media link. Retrying stream from source CDN.
					</p>
					<button
						type="button"
						onClick={() => {
							if (videoRef.current) {
								setHasError(false);
								videoRef.current.load();
								videoRef.current.play().catch(() => {});
							}
						}}
						className="mt-3 px-3 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded transition-all cursor-pointer"
					>
						Reconnect Node
					</button>
				</div>
			)}
		</div>
	);
}
