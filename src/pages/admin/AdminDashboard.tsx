import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Stethoscope, DollarSign, FileText, TrendingUp, Activity } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatBirr } from '@/lib/currency';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api-config';


const AdminDashboard = () => {
  const [stats, setStats] = useState({ patients: 0, doctors: 0, revenue: 0, bills: 0, pendingBills: 0, payments: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch(`${API_URL}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats', err);
        toast.error('Failed to load dashboard statistics');
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Patients', value: stats.patients, icon: Users, color: 'text-accent' },
    { label: 'Total Doctors', value: stats.doctors, icon: Stethoscope, color: 'text-primary' },
    { label: 'Revenue', value: formatBirr(stats.revenue), icon: DollarSign, color: 'text-success' },
    { label: 'Total Bills', value: stats.bills, icon: FileText, color: 'text-warning' },
    { label: 'Pending Bills', value: stats.pendingBills, icon: Activity, color: 'text-destructive' },
    { label: 'Payments', value: stats.payments, icon: TrendingUp, color: 'text-accent' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Welcome back, Admin</h2>
          <p className="text-muted-foreground">Here's an overview of your clinic system.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-heading text-card-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;

