import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import useVenueStore from '../../store/venueStore';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';
import {
  format, subDays, startOfDay, endOfDay,
  differenceInMinutes, eachHourOfInterval, eachDayOfInterval
} from 'date-fns';

const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#6366F1'];

const RANGES = [
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: 'Last 7 Days' },
  { value: '30d',    label: 'Last 30 Days' },
  { value: 'all',    label: 'All Time' },
];

function getDateRange(range) {
  const now = new Date();
  switch (range) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case '7d':    return { from: subDays(startOfDay(now), 6), to: endOfDay(now) };
    case '30d':   return { from: subDays(startOfDay(now), 29), to: endOfDay(now) };
    default:      return { from: null, to: null };
  }
}

function buildTimeSeries(incidents, range) {
  const now = new Date();
  if (range === 'today') {
    // By hour 0–23
    const hours = eachHourOfInterval({ start: startOfDay(now), end: endOfDay(now) });
    return hours.map(h => ({
      date: format(h, 'HH:mm'),
      count: incidents.filter(i => {
        const d = new Date(i.created_at);
        return d >= h && d < new Date(h.getTime() + 3600000);
      }).length,
    }));
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : null;
  if (days) {
    return eachDayOfInterval({ start: subDays(now, days - 1), end: now }).map(day => ({
      date: format(day, range === '7d' ? 'EEE d' : 'MMM d'),
      count: incidents.filter(i => format(new Date(i.created_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length,
    }));
  }
  // All time — group by month
  const byMonth = {};
  incidents.forEach(i => {
    const m = format(new Date(i.created_at), 'MMM yy');
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  return Object.entries(byMonth).map(([date, count]) => ({ date, count }));
}

export default function Analytics() {
  const { venue } = useVenueStore();
  const [range, setRange] = useState('7d');
  const [incidents, setIncidents] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venue?.id) return;
    fetchData();
  }, [venue, range]);

  const fetchData = async () => {
    setLoading(true);
    const { from, to } = getDateRange(range);

    let incQ = supabase.from('incidents').select('*').eq('venue_id', venue.id);
    let compQ = supabase.from('complaints').select('*').eq('venue_id', venue.id);

    if (from) {
      incQ  = incQ.gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
      compQ = compQ.gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
    }

    const [incRes, compRes] = await Promise.all([
      incQ.order('created_at', { ascending: true }),
      compQ.order('created_at', { ascending: true }),
    ]);

    setIncidents(incRes.data || []);
    setComplaints(compRes.data || []);
    setLoading(false);
  };

  // ── Derived metrics ──────────────────────────────────────────────────────
  const resolved   = incidents.filter(i => ['resolved', 'closed'].includes(i.status));
  const open       = incidents.filter(i => i.status === 'open');
  const avgResMin  = resolved.length > 0
    ? Math.round(resolved.reduce((sum, i) => {
        const end = i.closed_at || i.resolved_by_staff_at;
        return end ? sum + differenceInMinutes(new Date(end), new Date(i.created_at)) : sum;
      }, 0) / resolved.length)
    : 0;

  const timeSeries = buildTimeSeries(incidents, range);
  const compTimeSeries = buildTimeSeries(complaints, range);

  const byType = incidents.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {});
  const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));

  const bySeverity = incidents.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {});
  const severityData = Object.entries(bySeverity).map(([name, value]) => ({ name, value }));

  const byStatus = incidents.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});
  const statusData = Object.entries(byStatus).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  const compByCategory = complaints.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {});
  const compCatData = Object.entries(compByCategory).map(([name, value]) => ({ name, value }));

  const rangeLabel = RANGES.find(r => r.value === range)?.label || '';

  if (loading) return <Spinner className="py-16" size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-haven-dark">Analytics</h1>
        {/* Time range dropdown */}
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="input-field w-auto pr-8 text-sm font-medium"
        >
          {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Incidents',     value: incidents.length,   color: 'text-haven-dark' },
          { label: 'Resolved',            value: resolved.length,    color: 'text-green-600' },
          { label: 'Open',                value: open.length,        color: 'text-red-500' },
          { label: 'Avg Resolution',      value: `${avgResMin}m`,    color: 'text-blue-600' },
          { label: 'Total Complaints',    value: complaints.length,  color: 'text-purple-600' },
          { label: 'Complaints Resolved', value: complaints.filter(c => ['resolved','closed'].includes(c.status)).length, color: 'text-green-600' },
          { label: 'Complaints Open',     value: complaints.filter(c => c.status === 'open').length, color: 'text-orange-500' },
          { label: 'Range',               value: rangeLabel,         color: 'text-haven-muted' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <p className="label-caption">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Incidents over time */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm text-haven-dark mb-4">
          Incidents Over Time — {rangeLabel}
        </h3>
        {timeSeries.every(d => d.count === 0) ? (
          <p className="text-sm text-haven-muted text-center py-8">No incidents in this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={range === 'today' ? 3 : range === '30d' ? 4 : 0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#EF4444" strokeWidth={2} dot={range !== '30d'} name="Incidents" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Complaints over time */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm text-haven-dark mb-4">
          Complaints Over Time — {rangeLabel}
        </h3>
        {compTimeSeries.every(d => d.count === 0) ? (
          <p className="text-sm text-haven-muted text-center py-8">No complaints in this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={compTimeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={range === 'today' ? 3 : range === '30d' ? 4 : 0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} dot={range !== '30d'} name="Complaints" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents by type */}
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-haven-dark mb-4">Incidents by Type</h3>
          {typeData.length === 0 ? (
            <p className="text-sm text-haven-muted text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Complaints by category */}
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-haven-dark mb-4">Complaints by Category</h3>
          {compCatData.length === 0 ? (
            <p className="text-sm text-haven-muted text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={compCatData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Count" fill="#8B5CF6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Severity distribution */}
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-haven-dark mb-4">Incident Severity</h3>
          {severityData.length === 0 ? (
            <p className="text-sm text-haven-muted text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {severityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdown */}
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-haven-dark mb-4">Incident Status Breakdown</h3>
          {statusData.length === 0 ? (
            <p className="text-sm text-haven-muted text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" name="Count" radius={[0,4,4,0]}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
