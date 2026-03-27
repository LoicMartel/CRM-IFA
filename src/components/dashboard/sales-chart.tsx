"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SalesChartData {
  month: string;
  objectifCumule: number;
  realiseCumule: number;
}

export function SalesChart({ data }: { data: SalesChartData[] }) {
  return (
    <div className="lca-card">
      <div className="lca-bar-gradient" />
      <div style={{ padding: 20 }}>
        <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>
          Tendance Commandes — Objectif vs Réalisé
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#8399a9", fontSize: 11 }}
              axisLine={{ stroke: "#dce8f0" }}
            />
            <YAxis
              tick={{ fill: "#8399a9", fontSize: 11 }}
              axisLine={{ stroke: "#dce8f0" }}
              tickFormatter={(v) => `${Math.round(v / 1000)}K €`}
            />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value)) + " €"
              }
              contentStyle={{
                background: "white",
                border: "1px solid #dce8f0",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="circle"
            />
            <Line
              type="monotone"
              dataKey="objectifCumule"
              name="Objectif cumulé"
              stroke="#FF6B35"
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={{ fill: "#FF6B35", r: 4 }}
              animationDuration={1200}
              animationBegin={200}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="realiseCumule"
              name="Réalisé cumulé"
              stroke="#1a6b9c"
              strokeWidth={3}
              dot={{ fill: "#1a6b9c", r: 5 }}
              animationDuration={1500}
              animationBegin={400}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
