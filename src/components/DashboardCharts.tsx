import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function DashboardCharts({ stats }: { stats: any }) {
  const chartData = Object.keys(stats.monthlySales || {}).map(monthYear => ({
    month: monthYear,
    sales: stats.monthlySales[monthYear] || 0,
    purchases: stats.monthlyPurchases[monthYear] || 0
  })).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-widest">Sales vs Purchases Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="sales" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.3} name="Sales" />
            <Area type="monotone" dataKey="purchases" stroke="#e11d48" fill="#e11d48" fillOpacity={0.3} name="Purchases" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-widest">Monthly Summary</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Bar dataKey="sales" fill="#4f46e5" name="Sales" />
            <Bar dataKey="purchases" fill="#e11d48" name="Purchases" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
