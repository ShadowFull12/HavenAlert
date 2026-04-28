import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VenueCodeCard({ venueCode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(venueCode);
      setCopied(true);
      toast.success('Venue code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="w-5 h-5 text-haven-muted" />
        <h3 className="font-semibold text-haven-dark">Venue Code</h3>
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-3 bg-gray-50 rounded-xl px-6 py-4 mb-4">
          <span className="text-3xl font-bold tracking-widest text-haven-dark font-mono">
            {venueCode}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {copied ? (
              <Check className="w-5 h-5 text-success" />
            ) : (
              <Copy className="w-5 h-5 text-haven-muted" />
            )}
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <QRCodeSVG
              value={venueCode}
              size={160}
              bgColor="#ffffff"
              fgColor="#0F172A"
              level="M"
            />
          </div>
        </div>

        <p className="text-xs text-haven-muted">
          Share this code with guests so they can check into your venue
        </p>
      </div>
    </div>
  );
}
