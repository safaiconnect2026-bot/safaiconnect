import React, { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'green'
}) => {
  const colorClasses = {
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-green-100',
      icon: 'bg-gradient-to-br from-green-100 to-green-200 text-green-600',
      border: 'border-t-green-500'
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      icon: 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600',
      border: 'border-t-blue-500'
    },
    yellow: {
      bg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
      icon: 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-600',
      border: 'border-t-yellow-500'
    },
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100',
      icon: 'bg-gradient-to-br from-red-100 to-red-200 text-red-600',
      border: 'border-t-red-500'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      icon: 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600',
      border: 'border-t-purple-500'
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      icon: 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600',
      border: 'border-t-orange-500'
    }
  };

  const classes = colorClasses[color] || colorClasses.green;

  return (
    <div className={`${classes.bg} rounded-2xl p-6 border border-gray-200 ${classes.border} border-t-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center justify-center w-12 h-12 ${classes.icon} rounded-xl`}>
          {icon}
        </div>
        {trend && (
          <div className={`text-sm font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;