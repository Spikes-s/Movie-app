import React, { useState } from 'react';
import { Star, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface TenStarRatingProps {
  fileId: string;
  ratingAverage: number;
  ratingCount: number;
  initialUserRating: number | null;
  ratingDistribution?: Record<number, number>;
  onRatingUpdated?: (newAvg: number, newCount: number, newDist: Record<number, number>, userRating: number) => void;
  onRequireLogin?: () => void;
}

export const TenStarRating: React.FC<TenStarRatingProps> = ({
  fileId,
  ratingAverage,
  ratingCount,
  initialUserRating,
  ratingDistribution = {},
  onRatingUpdated,
  onRequireLogin
}) => {
  const { user } = useAuth();
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [currentRating, setCurrentRating] = useState<number | null>(initialUserRating);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStarClick = async (score: number) => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.rateFile(fileId, score);
      setCurrentRating(score);
      if (onRatingUpdated) {
        onRatingUpdated(res.ratingAverage, res.ratingCount, res.ratingDistribution, score);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit rating.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayScore = hoverRating !== null ? hoverRating : (currentRating || ratingAverage || 0);

  return (
    <div className="bg-[#12131a] border border-[#232634] rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {displayScore > 0 ? (typeof displayScore === 'number' ? displayScore.toFixed(1) : displayScore) : '—'}
            </span>
            <span className="text-sm font-semibold text-purple-400">/ 10</span>
            <span className="text-xs text-gray-400 ml-2">
              ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
            </span>
          </div>

          <p className="text-xs text-gray-400 mt-1">
            {currentRating
              ? `You rated this ${currentRating}/10 stars. Click any star to change.`
              : 'Rate this media on a scale of 1 to 10 stars'}
          </p>
        </div>

        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200 bg-purple-950/40 hover:bg-purple-900/40 px-3 py-1.5 rounded-lg border border-purple-800/40 transition"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Distribution</span>
          {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 10 Interactive Stars */}
      <div className="mt-4 pt-3 border-t border-[#1c1f2b]">
        <div className="flex items-center justify-between max-w-md">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starVal) => {
            const isFilled = (hoverRating !== null ? hoverRating >= starVal : (currentRating !== null ? currentRating >= starVal : ratingAverage >= starVal));

            return (
              <button
                key={starVal}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStarClick(starVal)}
                onMouseEnter={() => setHoverRating(starVal)}
                onMouseLeave={() => setHoverRating(null)}
                className="group relative p-1 focus:outline-none transition-transform hover:scale-125"
                title={`Rate ${starVal} out of 10`}
                aria-label={`Rate ${starVal} out of 10`}
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    isFilled
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                />
                <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {starVal}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between max-w-md text-[10px] text-gray-500 mt-5 px-1 font-medium">
          <span>1 (Poor)</span>
          <span>5 (Average)</span>
          <span>10 (Masterpiece)</span>
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs text-rose-400 mt-3">{errorMessage}</p>
      )}

      {/* Distribution breakdown */}
      {showBreakdown && (
        <div className="mt-5 pt-4 border-t border-[#1c1f2b] space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            10-Star Rating Breakdown
          </h4>
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((stars) => {
            const count = ratingDistribution[stars] || 0;
            const pct = ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0;

            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-right font-mono text-gray-400">
                  {stars} <span className="text-amber-400">★</span>
                </span>
                <div className="flex-1 bg-[#1c1f2b] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right text-gray-400 font-mono">
                  {count} <span className="text-gray-500">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
