import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { downloadCsv } from '@/lib/export';
import { Download, Edit, Plus, Trash2, Key } from 'lucide-react';
import { toast } from 'sonner';

type DoctorRow = any & {
  role_id?: string;
  role?: string;
  department_name?: string;
  referred_patients_count: number;
  total_billed_birr: number;
};

const birrFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  minimumFractionDigits: 2,
});

import { API_URL } from '@/lib/api-config';

const DoctorsPage = () => {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordDoctor, setResetPasswordDoctor] = useState<DoctorRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editDoctor, setEditDoctor] = useState<DoctorRow | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'general_doctor', department_id: '' });

  const fetchDoctors = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const [profilesRes, rolesRes, deptsRes, patientsRes, billsRes] = await Promise.all([
        fetch(`${API_URL}/profiles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/user_roles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/departments`),
        fetch(`${API_URL}/patients`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/bills`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      const [profiles, roles, depts, patients, bills] = await Promise.all([
        profilesRes.json(),
        rolesRes.json(),
        deptsRes.json(),
        patientsRes.json(),
        billsRes.json(),
      ]);

      setDepartments(depts || []);

      const staffProfiles = (profiles || [])
        .filter((profile: any) => {
          const role = (roles || []).find((row: any) => row.user_id === profile.user_id);
          return role && role.role !== 'admin';
        })
        .map((profile: any) => {
          const role = (roles || []).find((row: any) => row.user_id === profile.user_id);
          const department = (depts || []).find((dept: any) => dept.id === profile.department_id);
          const referredPatients = (patients || []).filter((patient: any) => patient.referred_specialist_id === profile.user_id);
          const referredPatientIds = new Set(referredPatients.map((patient: any) => patient.id));
          const totalBilledBirr = (bills || [])
            .filter((bill: any) => referredPatientIds.has(bill.patient_id))
            .reduce((sum: number, bill: any) => sum + Number(bill.final_amount), 0);

          return {
            ...profile,
            role_id: role?.id,
            role: role?.role,
            department_name: department?.name,
            referred_patients_count: referredPatients.length,
            total_billed_birr: totalBilledBirr,
          };
        });

      setDoctors(staffProfiles);
    } catch (err) {
      console.error('Failed to fetch staff', err);
      toast.error('Failed to load staff');
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const resetForm = () => {
    setOpen(false);
    setEditDoctor(null);
    setForm({ full_name: '', email: '', password: '', role: 'general_doctor', department_id: '' });
  };

  const handleSave = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      if (editDoctor) {
        const res = await fetch(`${API_URL}/doctors/${editDoctor.user_id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            full_name: form.full_name,
            role: form.role,
            department_id: form.role === 'specialist_doctor' ? (form.department_id || null) : null,
          })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to update staff');
        }
        toast.success('Staff updated successfully');
      } else {
        const res = await fetch(`${API_URL}/doctors`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            role: form.role,
            department_id: form.role === 'specialist_doctor' ? (form.department_id || null) : null,
          })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to create staff member');
        }
        toast.success('Staff member created successfully');
      }
      resetForm();
      fetchDoctors();
    } catch (err: any) {
      toast.error(err.message || (editDoctor ? 'Failed to update staff' : 'Failed to create staff member'));
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDoctor || !newPassword) return;
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_URL}/doctors/${resetPasswordDoctor.user_id}/reset_password`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }
      toast.success(`Password for ${resetPasswordDoctor.full_name} has been reset.`);
      setResetPasswordOpen(false);
      setResetPasswordDoctor(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    }
  };

  const handleDelete = async (userId: string) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_URL}/doctors/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete member');
      toast.success('Staff member deleted');
      fetchDoctors();
    } catch (err) {
      toast.error('Failed to delete member');
    }
  };

  const handleEdit = (doctor: DoctorRow) => {
    setEditDoctor(doctor);
    setForm({
      full_name: doctor.full_name,
      email: doctor.email,
      password: '',
      role: doctor.role || 'general_doctor',
      department_id: doctor.department_id || '',
    });
    setOpen(true);
  };

  const handleExport = () => {
    downloadCsv('staff.csv', doctors.map((doctor) => ({
      Name: doctor.full_name,
      Email: doctor.email,
      Role: doctor.role || '-',
      Department: doctor.department_name || '-',
      SpecialistPatients: doctor.referred_patients_count,
      TotalBilledBirr: doctor.total_billed_birr.toFixed(2),
    })));
  };

  const roleBadgeColor = (role?: string) => {
    if (role === 'general_doctor') return 'bg-primary/10 text-primary';
    if (role === 'specialist_doctor') return 'bg-accent/10 text-accent';
    if (role === 'laboratory_technician') return 'bg-success/10 text-success';
    return '';
  };

  const formatRoleName = (role?: string) => {
    if (role === 'general_doctor') return 'General';
    if (role === 'specialist_doctor') return 'Specialist';
    if (role === 'laboratory_technician') return 'Lab Tech';
    return role;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold">Staff Management</h2>
            <p className="text-muted-foreground">Manage clinic staff roles and clinical assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={doctors.length === 0}>
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Staff Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editDoctor ? 'Edit Member' : 'Add New Staff Member'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={Boolean(editDoctor)} />
                  </div>
                  {!editDoctor && (
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general_doctor">General Doctor</SelectItem>
                        <SelectItem value="specialist_doctor">Specialist Doctor</SelectItem>
                        <SelectItem value="laboratory_technician">Laboratory Technician</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.role === 'specialist_doctor' && (
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={form.department_id} onValueChange={(value) => setForm({ ...form, department_id: value })}>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          {departments.map((department) => (
                            <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button onClick={handleSave} className="w-full">{editDoctor ? 'Update Staff Member' : 'Create Staff Member'}</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={resetPasswordOpen} onOpenChange={(val) => { setResetPasswordOpen(val); if (!val) { setNewPassword(''); setResetPasswordDoctor(null); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Password for {resetPasswordDoctor?.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                  </div>
                  <Button onClick={handleResetPassword} className="w-full" disabled={!newPassword}>Reset Password</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Ref. Patients</TableHead>
                  <TableHead>Total Billed</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-medium">{doctor.full_name}</TableCell>
                    <TableCell>{doctor.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={roleBadgeColor(doctor.role)}>
                        {formatRoleName(doctor.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>{doctor.department_name || '-'}</TableCell>
                    <TableCell>{doctor.role === 'specialist_doctor' ? doctor.referred_patients_count : '-'}</TableCell>
                    <TableCell className="font-medium">
                      {doctor.role === 'specialist_doctor' ? birrFormatter.format(doctor.total_billed_birr) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setResetPasswordDoctor(doctor); setResetPasswordOpen(true); }} title="Reset Password">
                          <Key className="h-4 w-4 text-amber-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(doctor)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(doctor.user_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {doctors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No staff members found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DoctorsPage;

