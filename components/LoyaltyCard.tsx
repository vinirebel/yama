import React, { useState } from 'react';
import { Check, Gift, QrCode, ArrowLeft } from 'lucide-react';
import QRCode from "react-qr-code";
import { LoyaltyConfig, StampCard } from '../types';

interface LoyaltyCardProps {
  card: StampCard;
  config: LoyaltyConfig;
}

export const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ card, config }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const totalSlots = config.totalStamps;
  const filledSlots = card.currentStamps;

  return (
    <div className="w-full max-w-md mx-auto perspective-1000 h-[320px]">
      <div 
        className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
      >
        
        {/* FRONT OF CARD */}
        <div className="absolute w-full h-full backface-hidden">
          <div className="h-full bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm opacity-80 uppercase tracking-wider font-semibold">Cartão Fidelidade</h3>
                <h2 className="text-2xl font-bold mt-1">{config.businessName}</h2>
              </div>
              <button 
                onClick={() => setIsFlipped(true)}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                title="Ver QR Code"
              >
                <QrCode className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2 my-auto">
              {Array.from({ length: totalSlots }).map((_, index) => {
                const isFilled = index < filledSlots;
                const isLast = index === totalSlots - 1;

                return (
                  <div 
                    key={index}
                    className={`
                      aspect-square rounded-full flex items-center justify-center text-sm font-bold relative
                      transition-all duration-500 ease-out
                      ${isFilled 
                        ? 'bg-white text-brand-700 scale-100 shadow-lg shadow-black/20' 
                        : 'bg-brand-900/40 text-brand-200 scale-90 border-2 border-brand-500/30'}
                    `}
                  >
                    {isFilled ? (
                      <Check className="w-4 h-4 animate-[bounce_0.5s_ease-out]" strokeWidth={3} />
                    ) : isLast ? (
                      <Gift className="w-3 h-3 opacity-50" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div>
              <div className="flex items-center justify-between text-xs opacity-70 mb-2">
                <span>ID: {card.userId.slice(-6)}</span>
                <span>{filledSlots}/{totalSlots} Selos</span>
              </div>
              <div className="h-2 bg-brand-900/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-400 transition-all duration-1000 ease-out"
                  style={{ width: `${(filledSlots / totalSlots) * 100}%` }}
                />
              </div>
            </div>

            {/* Completed Overlay */}
            {card.completed && !card.redeemed && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in z-20">
                <Gift className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                <h3 className="text-xl font-bold mb-2">Parabéns!</h3>
                <p className="text-sm opacity-90 mb-4">Você completou sua cartela! Mostre ao caixa para resgatar.</p>
              </div>
            )}
          </div>
        </div>

        {/* BACK OF CARD (QR CODE) */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180">
          <div className="h-full bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center border-2 border-brand-100">
            <button 
              onClick={() => setIsFlipped(false)}
              className="absolute top-4 left-4 p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <h3 className="text-brand-900 font-bold text-lg mb-6">Seu Código Único</h3>
            
            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
              <QRCode 
                value={card.userId} 
                size={160}
                viewBox={`0 0 256 256`}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            
            <p className="mt-6 text-xs text-gray-400 text-center font-mono">
              {card.userId}
            </p>
            <p className="mt-1 text-sm text-gray-500 text-center">
              Apresente este código no caixa para ganhar selos.
            </p>
          </div>
        </div>

      </div>
      
      <div className="mt-6 text-center">
        <p className="text-brand-900 font-medium">Prêmio: {config.rewardDescription}</p>
      </div>
    </div>
  );
};