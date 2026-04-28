# 🛡️ HavenAlert

[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.0-purple?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-black?style=for-the-badge&logo=react)](https://github.com/pmndrs/zustand)
[![Google Gemini AI](https://img.shields.io/badge/Gemini_AI-Enabled-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

**HavenAlert** is a robust hospitality crisis management and venue operations platform. It provides real-time incident tracking, staff coordination, and a seamless guest experience for reporting issues and requesting help.

---

## 🌟 Key Features

* **🚨 Real-Time Incident Management**: Complete SOS and incident lifecycle tracking. Guests can report issues instantly, and staff receive priority-based notifications.
* **👥 Advanced Staff Management & RBAC**: Discord-style role-based access control. Managers can generate invite codes, assign roles, and apply per-staff permission overrides.
* **📊 Comprehensive Analytics**: Multi-range dashboards providing insights into incident volumes, resolution times, severity distribution, and staff workload.
* **💬 Real-Time Chat & Broadcasts**: Built-in chat for incident/complaint threads. Managers can send one-way broadcast messages to all currently checked-in guests.
* **🏨 Venue & Room Management**: Easily manage floors, rooms, and check-in/checkout guest queues with QR codes.
* **🧠 AI-Powered Briefings**: Integrated with Google Gemini AI to auto-generate quick, actionable incident briefings for staff.
* **📋 Audit Logs**: Full trackability of all actions taken within the venue by staff and managers.

---

## 🛠️ Tech Stack

* **Frontend Framework**: React 19 + Vite
* **Routing**: React Router v7
* **Styling**: Tailwind CSS
* **State Management**: Zustand
* **Backend & Database**: Supabase (PostgreSQL)
* **Realtime**: Supabase Realtime Channels
* **Icons**: Lucide React
* **Charts**: Recharts
* **Maps**: Leaflet + React Leaflet

---

## 🚀 Getting Started

### Prerequisites

* Node.js v18+
* A Supabase project
* A Gemini AI API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ShadowFull12/HavenAlert.git
   cd HavenAlert
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and add the following:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Database Setup**
   Run the provided `database.sql` script in your Supabase SQL Editor to generate the necessary tables, types, triggers, and Row Level Security (RLS) policies.

5. **Start the Development Server**
   ```bash
   npm run dev
   ```

---

## 🏗️ Deployment (Vercel)

HavenAlert is fully prepared for Vercel deployment:

1. Connect your GitHub repository to Vercel.
2. In the Vercel dashboard, configure the following Environment Variables:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
   * `VITE_GEMINI_API_KEY`
3. Deploy! Vercel will automatically run `npm run build` using Vite.

---

## 🔐 Role-Based Access Control (RBAC)

The platform supports distinct role tiers:

* **Guest**: Can submit SOS, complaints, and chat with staff regarding their specific incidents.
* **Staff**: Read-only access to venue dashboards, capable of resolving assigned incidents.
* **Manager**: Full access to assign tasks, edit venue settings, invite staff, manage RBAC, and handle unassigned incidents.
* **Owner**: Ultimate venue control, billing, and complete structural management.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](https://github.com/ShadowFull12/HavenAlert/issues) if you want to contribute.

## 📄 License

This project is licensed under the MIT License.
