import React from 'react';
import { motion } from 'motion/react';

interface KPICardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

export default function KPICard({ title, value, description, icon, colorClass }: KPICardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 flex items-center gap-5"
    >
      <div className={`p-4 rounded-xl ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      </div>
    </motion.div>
  );
}
