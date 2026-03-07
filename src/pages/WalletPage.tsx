import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserLayout } from '@/components/layout/UserLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Copy,
  Check,
  Users,
  IndianRupee,
  Loader2,
  Share2,
  Gift,
  Clock,
  CheckCircle2,
  XCircle,
  BanknoteIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Fetch referral code from profile
  const { data: profile } = useQuery({
    queryKey: ['profile-referral', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/signup?ref=${profile.referral_code}`
    : '';

  // Generate referral code if not exists
  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      await supabase.rpc('generate_referral_code', { _user_id: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-referral'] });
      toast.success('Referral code generated!');
    },
    onError: () => {
      toast.error('Failed to generate referral code');
    },
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: commissions } = useQuery({
    queryKey: ['commissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('commissions')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: withdrawals } = useQuery({
    queryKey: ['withdrawals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');
      if (!wallet || amount > wallet.balance) throw new Error('Insufficient balance');
      if (amount < 50) throw new Error('Minimum withdrawal is ₹50');

      let paymentDetails: Json;

      if (paymentMethod === 'upi') {
        if (!upiId.trim()) throw new Error('Please enter UPI ID');
        paymentDetails = { upi_id: upiId };
      } else {
        if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim() || !accountHolderName.trim()) {
          throw new Error('Please fill all bank details');
        }
        paymentDetails = {
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          account_holder_name: accountHolderName,
        };
      }

      const { error } = await supabase.from('withdrawal_requests').insert({
        user_id: user.id,
        amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      toast.success('Withdrawal request submitted! We will process it within 3-5 business days.');
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setUpiId('');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setAccountHolderName('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const totalEarned = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const totalWithdrawn = withdrawals
    ?.filter(w => w.status === 'completed')
    .reduce((sum, w) => sum + w.amount, 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-primary text-primary-foreground"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!user) {
    return (
      <UserLayout>
        <div className="content-container py-16 text-center">
          <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">My Wallet</h1>
          <p className="text-muted-foreground mb-6">Please log in to view your wallet</p>
          <Button asChild><Link to="/login">Log In</Link></Button>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="content-container py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-8">My Wallet</h1>

          {/* Wallet Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/20 to-gold/10 border-primary/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <IndianRupee className="w-4 h-4" />
                  <span className="text-sm">Available Balance</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  ₹{walletLoading ? '...' : (wallet?.balance || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ArrowDownCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Total Earned</span>
                </div>
                <p className="text-3xl font-bold text-foreground">₹{totalEarned}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ArrowUpCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm">Total Withdrawn</span>
                </div>
                <p className="text-3xl font-bold text-foreground">₹{totalWithdrawn}</p>
              </CardContent>
            </Card>
          </div>

          {/* Withdraw Button */}
          <div className="mb-8">
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-gradient-warm hover:opacity-90"
                  disabled={!wallet || wallet.balance < 50}
                >
                  <BanknoteIcon className="w-4 h-4 mr-2" />
                  Withdraw Funds
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Withdraw Funds</DialogTitle>
                  <DialogDescription>
                    Enter withdrawal amount and payment details. Minimum ₹50.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Enter amount"
                      min={50}
                      max={wallet?.balance || 0}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: ₹{wallet?.balance || 0}
                    </p>
                  </div>

                  <div>
                    <Label>Payment Method</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentMethod('upi')}
                      >
                        UPI
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'bank' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentMethod('bank')}
                      >
                        Bank Transfer
                      </Button>
                    </div>
                  </div>

                  {paymentMethod === 'upi' ? (
                    <div>
                      <Label>UPI ID</Label>
                      <Input
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label>Account Holder Name</Label>
                        <Input
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <Label>Bank Name</Label>
                        <Input
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. State Bank of India"
                        />
                      </div>
                      <div>
                        <Label>Account Number</Label>
                        <Input
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="Account number"
                        />
                      </div>
                      <div>
                        <Label>IFSC Code</Label>
                        <Input
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value)}
                          placeholder="e.g. SBIN0001234"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => withdrawMutation.mutate()}
                    disabled={withdrawMutation.isPending}
                    className="w-full bg-gradient-warm hover:opacity-90"
                  >
                    {withdrawMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Submit Withdrawal Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {wallet && wallet.balance < 50 && wallet.balance > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Minimum withdrawal amount is ₹50
              </p>
            )}
          </div>

          {/* Referral Link Section */}
          <Card className="mb-8 border-primary/30 bg-gradient-to-r from-primary/5 to-gold/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Refer & Earn ₹50
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Share your referral link with friends. When they subscribe for the first time, 
                you earn ₹50 in your wallet!
              </p>
              {referralLink ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={referralLink}
                      readOnly
                      className="bg-background font-mono text-sm"
                    />
                    <Button onClick={copyReferralLink} variant="outline" className="shrink-0">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: 'Join PLAYoga!',
                            text: 'Start your yoga journey with PLAYoga. Use my referral link to sign up!',
                            url: referralLink,
                          });
                        } else {
                          copyReferralLink();
                        }
                      }}
                      variant="outline"
                      className="shrink-0"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {referrals && referrals.length > 0 && (
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {referrals.length} referral{referrals.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        {referrals.filter(r => r.status === 'completed').length} converted
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <Button
                  onClick={() => generateCodeMutation.mutate()}
                  disabled={generateCodeMutation.isPending}
                  className="bg-gradient-warm hover:opacity-90"
                >
                  {generateCodeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Generate My Referral Link
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Commissions, Referrals, Withdrawals */}
          <Tabs defaultValue="commissions">
            <TabsList className="w-full">
              <TabsTrigger value="commissions" className="flex-1">Earnings</TabsTrigger>
              <TabsTrigger value="referrals" className="flex-1">Referrals</TabsTrigger>
              <TabsTrigger value="withdrawals" className="flex-1">Withdrawals</TabsTrigger>
            </TabsList>

            <TabsContent value="commissions">
              <Card>
                <CardContent className="pt-6">
                  {!commissions || commissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No earnings yet. Share your referral link to start earning!</p>
                  ) : (
                    <div className="space-y-3">
                      {commissions.map((c) => (
                        <div key={c.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <ArrowDownCircle className="w-5 h-5 text-success" />
                            <div>
                              <p className="font-medium text-sm">Referral Commission</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-success">+₹{c.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="referrals">
              <Card>
                <CardContent className="pt-6">
                  {!referrals || referrals.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No referrals yet. Share your link to start earning!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {referrals.map((ref) => (
                        <div key={ref.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-sm">Referral</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ref.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          {getStatusBadge(ref.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdrawals">
              <Card>
                <CardContent className="pt-6">
                  {!withdrawals || withdrawals.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No withdrawal requests yet</p>
                  ) : (
                    <div className="space-y-3">
                      {withdrawals.map((w) => (
                        <div key={w.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-sm">
                              ₹{w.amount} via {w.payment_method.toUpperCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(w.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          {getStatusBadge(w.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </UserLayout>
  );
};

export default WalletPage;
