// src/components/SprintChart.tsx
"use client";

import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { Timer } from "lucide-react";

type DataPoint = {
  date: string;
  value: number;
};

// Tooltip personnalisé pour un look premium
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111111]/90 backdrop-blur-md border border-border/50 rounded-xl p-2 md:p-3 shadow-2xl">
        <p className="text-[9px] md:text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">
          {label}
        </p>
        <div className="flex items-center gap-1.5 md:gap-2">
          <Timer size={12} className="text-strain md:w-3.5 md:h-3.5" />
          <p className="text-sm md:text-lg font-bold text-white leading-none">
            {payload[0].value.toFixed(2)} <span className="text-[10px] md:text-xs text-text-muted">s</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function SprintChart({ data }: { data: DataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full min-h-[150px] md:min-h-[250px] flex flex-col items-center justify-center text-text-muted text-xs md:text-sm border border-dashed border-border rounded-2xl bg-surface/30 p-4 text-center">
        <Timer size={24} className="mb-2 md:mb-3 opacity-20 md:w-8 md:h-8" />
        <p>Aucune donnée disponible.</p>
        <p className="text-[10px] md:text-xs text-text-muted/60 mt-1">Enregistrez un test pour voir votre évolution.</p>
      </div>
    );
  }

  // Formater les données pour le graphique
  const chartData = data.map((d) => ({
    ...d,
    dateFormatted: new Date(d.date).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' }),
  }));

  return (
    <div className="w-full h-full min-h-[180px] md:min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
          <defs>
            {/* Dégradé pour la zone sous la courbe */}
            <linearGradient id="colorSprint" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0093E7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#0093E7" stopOpacity={0}/>
            </linearGradient>
          </defs>

          {/* Grille de fond subtile (cachée sur mobile pour alléger) */}
          <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} className="hidden md:block" />

          <XAxis 
            dataKey="dateFormatted" 
            stroke="#636366" 
            fontSize={10} // Réduit pour mobile
            tickLine={false} 
            axisLine={false}
            dy={10}
            minTickGap={15} // Espacement minimum pour éviter le chevauchement
          />
          <YAxis 
            stroke="#636366" 
            fontSize={10} // Réduit pour mobile
            tickLine={false} 
            axisLine={false}
            domain={['dataMin - 0.1', 'dataMax + 0.1']} 
            tickFormatter={(val) => `${val.toFixed(1)}s`}
            width={35} // Force une largeur pour éviter que l'axe ne disparaisse
          />
          
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333333', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#0093E7" 
            strokeWidth={2.5} // Légèrement plus fin sur mobile
            fillOpacity={1} 
            fill="url(#colorSprint)" 
            dot={{ fill: '#020202', stroke: '#0093E7', strokeWidth: 2, r: 3 }} // Points plus petits
            activeDot={{ r: 5, fill: '#0093E7', stroke: '#FFFFFF', strokeWidth: 2 }} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}