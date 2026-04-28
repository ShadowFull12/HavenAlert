import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Building2, ArrowRight, AlertTriangle, Radio, BarChart3, Lock } from 'lucide-react';
import Button from '../components/ui/Button';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-haven-dark text-white overflow-hidden">
      {/* Hero */}
      <div className="relative">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-danger/5 via-transparent to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-12 md:pt-28 md:pb-20">
          {/* Logo & Nav */}
          <div className="flex items-center justify-between mb-16 md:mb-24">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-danger" />
              </div>
              <span className="text-xl font-bold tracking-tight">HavenAlert</span>
            </div>
            <button
              onClick={() => navigate('/auth/staff-login')}
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              Staff Login
            </button>
          </div>

          {/* Main Hero Content */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-danger/10 text-danger px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Radio className="w-3.5 h-3.5" />
              Real-time Crisis Management
            </div>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 tracking-tight">
              Protect Your Guests.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-danger via-orange-400 to-amber-400">
                Respond in Seconds.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              The all-in-one crisis response platform for hotels, resorts, and venues. 
              One-tap SOS, AI-powered triage, real-time staff coordination, and complete compliance tracking.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/auth/guest-register')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 
                          bg-white text-haven-dark px-8 py-4 rounded-xl font-semibold text-base
                          hover:bg-gray-100 active:scale-[0.98] transition-all duration-150
                          min-h-[56px]"
              >
                <Users className="w-5 h-5" />
                I'm a Guest
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/auth/venue-register')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 
                          bg-haven-surface text-white px-8 py-4 rounded-xl font-semibold text-base
                          border border-haven-border
                          hover:bg-slate-700 active:scale-[0.98] transition-all duration-150
                          min-h-[56px]"
              >
                <Building2 className="w-5 h-5" />
                I Manage a Venue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: AlertTriangle,
              title: 'One-Tap SOS',
              desc: 'Guests trigger emergency alerts in under 2 seconds. Silent mode available for sensitive situations.',
              color: 'text-danger bg-danger/10'
            },
            {
              icon: Radio,
              title: 'Real-Time Response',
              desc: 'Live incident tracking, staff coordination, and AI-generated briefings — everything updates instantly.',
              color: 'text-info bg-info/10'
            },
            {
              icon: BarChart3,
              title: 'Full Compliance',
              desc: 'Immutable audit trails, incident reports, and analytics. Every action is logged for complete accountability.',
              color: 'text-success bg-success/10'
            }
          ].map(({ icon: Icon, title, desc, color }, i) => (
            <div key={i} className="card-dark p-6 rounded-2xl">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-haven-border">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-haven-muted" />
            <span className="text-sm text-haven-muted">HavenAlert © 2026</span>
          </div>
          <p className="text-sm text-haven-muted">Built for safety. Designed for speed.</p>
        </div>
      </div>
    </div>
  );
}
