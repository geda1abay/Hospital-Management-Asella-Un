import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBirr } from '@/lib/currency';
import { downloadCsv } from '@/lib/export';
import { ClipboardPlus, Download, UserPlus, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api-config';

const GeneralDoctorPage = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [signs, setSigns] = useState('');
  const [referDeptId, setReferDeptId] = useState('');
  const [referDoctorId, setReferDoctorId] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem('auth_token');
    
    try {
      const [patientsRes, departmentsRes, profilesRes, paymentsRes, billsRes, labsRes] = await Promise.all([
        fetch(`${API_URL}/patients`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/departments`),
        fetch(`${API_URL}/profiles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/payments`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/bills`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/lab_requests`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      const [patientsData, departmentsData, profilesData, paymentsData, billsData, labsData] = await Promise.all([
        patientsRes.json(),
        departmentsRes.json(),
        profilesRes.json(),
        paymentsRes.json(),
        billsRes.json(),
        labsRes.json(),
      ]);

      setPatients(patientsData || []);
      setDepartments(departmentsData || []);
      setPayments(paymentsData || []);
      setBills(billsData || []);
      setLabRequests(labsData || []);

      const departmentAssignedProfiles = (profilesData || []).filter((profile: any) => profile.department_id);
      setSpecialists(departmentAssignedProfiles);
    } catch (err) {
      console.error('Failed to fetch data', err);
      toast.error('Failed to load data');
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDiagnose = async () => {
    if (!selectedPatient || !user) return;
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`${API_URL}/diagnoses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: user.id,
          diagnosis,
          notes: notes || null,
        })
      });

      if (!res.ok) throw new Error('Failed to save diagnosis');

      toast.success('Diagnosis saved');
      setDiagnoseOpen(false);
      setDiagnosis('');
      setNotes('');
      setSymptoms('');
      setSigns('');
    } catch (err) {
      toast.error('Failed to save diagnosis');
    }
  };

  const handleRefer = async () => {
    if (!selectedPatient || !user) return;
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`${API_URL}/patients/${selectedPatient.id}/refer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          referred_specialist_id: referDoctorId,
          referral_department_id: referDeptId,
        })
      });

      if (!res.ok) throw new Error('Failed to refer');

      toast.success('Patient referred');
      setReferOpen(false);
      setReferDeptId('');
      setReferDoctorId('');
      fetchData();
    } catch (err) {
      toast.error('Failed to refer');
    }
  };

  const filteredSpecialists = specialists.filter((specialist) => specialist.department_id === referDeptId);
  const hasSpecialistsInDepartment = filteredSpecialists.length > 0;

  const statusColor = (status: string) => {
    if (status === 'active') return 'bg-success/10 text-success';
    if (status === 'referred') return 'bg-warning/10 text-warning';
    return 'bg-muted text-muted-foreground';
  };

  const handleExport = () => {
    downloadCsv('general-doctor-patients.csv', patients.map((patient) => ({
      Name: patient.name,
      Age: patient.age,
      Gender: patient.gender,
      Contact: patient.contact,
      Status: patient.status,
    })));
  };

  const getTransactions = () => {
    const transactions = [
      ...bills.map((b) => {
        const patientName = patients.find(pat => pat.id === b.patient_id)?.name || '-';
        return {
          id: `bill-${b.id}`,
          type: 'Bill Generated',
          patient_name: patientName,
          amount: Number(b.final_amount),
          date: b.created_at,
        };
      }),
      ...payments.map((p) => {
        const bill = bills.find(b => b.id === p.bill_id);
        const patientName = patients.find(pat => pat.id === bill?.patient_id)?.name || '-';
        return {
          id: `payment-${p.id}`,
          type: 'Payment Received',
          patient_name: patientName,
          amount: Number(p.amount),
          date: p.created_at,
        };
      }),
      ...labRequests.filter(l => l.cost_birr > 0).map(l => {
        return {
          id: `lab-${l.id}`,
          type: `Lab Test (${l.test_description})`,
          patient_name: patients.find(pat => pat.id === l.patient_id)?.name || '-',
          amount: Number(l.cost_birr),
          date: l.created_at,
        };
      })
    ];
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const transactions = getTransactions();
  const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold">My Patients</h2>
            <p className="text-muted-foreground">View and manage your assigned patients</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={patients.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export
          </Button>
        </div>

        <Tabs defaultValue="patients" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="patients">My Patients</TabsTrigger>
            <TabsTrigger value="budget">Clinic Budget</TabsTrigger>
          </TabsList>

          <TabsContent value="patients" className="pt-4">
            <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell className="capitalize">{patient.gender}</TableCell>
                    <TableCell>{patient.contact}</TableCell>
                    <TableCell><Badge variant="secondary" className={statusColor(patient.status)}>{patient.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient(patient); setDiagnoseOpen(true); }}>
                          <ClipboardPlus className="mr-1 h-4 w-4" />Diagnose
                        </Button>
                        {patient.status === 'active' && (
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient(patient); setReferOpen(true); }}>
                            <UserPlus className="mr-1 h-4 w-4" />Refer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {patients.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No assigned patients</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="budget" className="pt-4">
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium">Total Clinic Revenue</p>
                <DollarSign className="h-4 w-4 opacity-70" />
              </div>
              <div className="flex items-baseline space-x-2">
                <h2 className="text-3xl font-bold">{formatBirr(totalIncome)}</h2>
              </div>
              <p className="text-xs opacity-70 mt-1">From all generated bills, payments and lab fees</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.patient_name}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell className="font-bold text-success">
                      {formatBirr(t.amount)}
                    </TableCell>
                    <TableCell>{new Date(t.date).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No recorded revenue</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

        {/* Dialogs remain the same but call new handlers */}
        <Dialog open={diagnoseOpen} onOpenChange={setDiagnoseOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Diagnosis - {selectedPatient?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Symptoms</Label>
                <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Enter reported symptoms..." />
              </div>
              <div className="space-y-2">
                <Label>Clinical Signs</Label>
                <Textarea value={signs} onChange={(e) => setSigns(e.target.value)} placeholder="Enter observed signs..." />
              </div>
              <div className="space-y-2">
                <Label>Diagnosis</Label>
                <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Enter diagnosis..." />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
              </div>
              <Button onClick={handleDiagnose} className="w-full">Save Diagnosis</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={referOpen} onOpenChange={setReferOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Refer Patient - {selectedPatient?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={referDeptId} onValueChange={(value) => { setReferDeptId(value); setReferDoctorId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {referDeptId && (
                <div className="space-y-2">
                  <Label>Specialist Doctor</Label>
                  <Select value={referDoctorId} onValueChange={setReferDoctorId} disabled={!hasSpecialistsInDepartment}>
                    <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                    <SelectContent>
                      {filteredSpecialists.map((specialist) => <SelectItem key={specialist.user_id} value={specialist.user_id}>{specialist.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!hasSpecialistsInDepartment && (
                    <p className="text-sm text-muted-foreground">
                      No specialist doctor is assigned to this department yet.
                    </p>
                  )}
                </div>
              )}
              <Button onClick={handleRefer} className="w-full" disabled={!referDoctorId}>Refer Patient</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default GeneralDoctorPage;

