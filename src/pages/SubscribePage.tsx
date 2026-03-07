import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Check, Sparkles, Video, Calendar, Shield, ArrowRight, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal: {
    ondismiss: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const SubscribePage: React.FC = () => {
  const { user, hasActiveSubscription, refreshSubscriptionStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponId, setCouponId] = useState<string | null>(null);

  const basePrice = 999; // Production price
  const gstRate = 0.05;
  const discountedPrice = basePrice - discount;
  const gstAmount = discountedPrice * gstRate;
  const totalAmount = discountedPrice + gstAmount;

  const features = [
    { icon: Video, text: "Unlimited access to all premium videos" },
    { icon: Calendar, text: "Join exclusive live yoga sessions" },
    { icon: Sparkles, text: "Earn 2x Yogic Points on all sessions" },
    { icon: Shield, text: "Ad-free experience" },
  ];

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Auto login from app token
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) return;

    const autoLogin = async () => {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error("Auto login error:", error.message);
          return;
        }

        // 🔥 Force refresh user
        await supabase.auth.getUser();

        await refreshSubscriptionStatus();

        // Remove tokens from URL
        navigate("/subscribe", { replace: true });
      } catch (error) {
        console.error("Auto login failed:", error);
      }
    };

    autoLogin();
  }, [location.search]);
  useEffect(() => {
    console.log("User:", user);
  }, [user]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);

    try {
      // Call edge function to validate coupon securely
      const response = await supabase.functions.invoke("validate-coupon", {
        body: { code: couponCode, baseAmount: basePrice },
      });

      if (response.error) {
        toast.error("Failed to validate coupon");
        setIsApplyingCoupon(false);
        return;
      }

      const result = response.data;

      if (!result.valid) {
        toast.error(result.message || "Invalid coupon code");
        setIsApplyingCoupon(false);
        return;
      }

      setDiscount(result.discount);
      setCouponId(result.couponId);
      toast.success(result.message);
    } catch {
      toast.error("Failed to apply coupon");
    }

    setIsApplyingCoupon(false);
  };

  const handleSubscribe = async () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (!window.Razorpay) {
      toast.error("Payment system is loading. Please try again.");
      return;
    }

    setIsProcessing(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Please log in to continue");
      }

      // Create order
      const orderResponse = await supabase.functions.invoke("create-razorpay-order", {
        body: { amount: basePrice, couponCode: couponCode || undefined },
      });

      if (orderResponse.error) {
        throw new Error(orderResponse.error.message || "Failed to create order");
      }

      const { orderId, amount, keyId, prefill, notes } = orderResponse.data;

      // Open Razorpay checkout
      const options: RazorpayOptions = {
        key: keyId,
        amount: amount,
        currency: "INR",
        name: "PLAYoga",
        description: "Premium Yearly Subscription",
        order_id: orderId,
        prefill: {
          name: prefill.name || "",
          email: prefill.email || "",
          contact: prefill.contact || "",
        },
        theme: {
          color: "#D4A574",
        },
        handler: async (response: RazorpayResponse) => {
          try {
            // Verify payment
            const verifyResponse = await supabase.functions.invoke("verify-razorpay-payment", {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                couponId: notes.couponId,
                baseAmount: notes.baseAmount,
                gstAmount: notes.gstAmount,
                discountAmount: notes.discount,
                totalAmount: amount / 100,
              },
            });

            if (verifyResponse.error) {
              throw new Error(verifyResponse.error.message || "Payment verification failed");
            }

            toast.success("Payment successful! Welcome to Premium!");
            await refreshSubscriptionStatus();
            navigate("/browse");
          } catch (err) {
            console.error("Payment verification error:", err);
            toast.error("Payment verification failed. Please contact support.");
          }
          setIsProcessing(false);
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info("Payment cancelled");
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error("Payment error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
      setIsProcessing(false);
    }
  };

  if (hasActiveSubscription) {
    return (
      <UserLayout>
        <div className="content-container py-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <Crown className="w-10 h-10 text-success" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-4">You're Already Premium!</h1>
            <p className="text-muted-foreground mb-8">
              You have full access to all premium content. Enjoy your yoga journey!
            </p>
            <Button asChild className="bg-gradient-warm">
              <Link to="/browse">
                Browse Premium Content
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="content-container py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gold/10 text-gold mb-6">
              <Crown className="w-4 h-4" />
              <span className="text-sm font-medium">Premium Membership</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Unlock Your Full Potential</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get unlimited access to all premium yoga classes, live sessions, and exclusive content for just ₹999/year.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Features */}
            <div className="bg-card border border-border rounded-3xl p-8">
              <h2 className="font-display text-2xl font-semibold mb-6">What's Included</h2>
              <div className="space-y-4">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-medium">{feature.text}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 p-4 rounded-2xl bg-muted/50">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <span>30-day money-back guarantee</span>
                </div>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="bg-gradient-to-br from-charcoal to-terracotta-dark rounded-3xl p-8 text-white">
              <div className="text-center mb-8">
                <span className="text-sm text-white/70">Yearly Plan</span>
                <div className="mt-2">
                  <span className="text-5xl font-display font-bold">₹{discountedPrice}</span>
                  <span className="text-white/70">/year</span>
                </div>
                {discount > 0 && <div className="mt-2 text-sm text-gold">You save ₹{discount}!</div>}
              </div>

              {/* Coupon Input */}
              <div className="mb-6">
                <Label htmlFor="coupon" className="text-white/70">
                  Have a coupon?
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="coupon"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter code"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                  <Button
                    variant="outline"
                    onClick={applyCoupon}
                    disabled={isApplyingCoupon}
                    className="border-white bg-white/20 text-white hover:bg-white/30 font-medium"
                  >
                    {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between text-white/70">
                  <span>Base Price</span>
                  <span>₹{basePrice}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-gold">
                    <span>Coupon Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-white/70">
                  <span>GST (5%)</span>
                  <span>₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/20 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={isProcessing}
                size="lg"
                className="w-full bg-white text-charcoal hover:bg-white/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Subscribe Now
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-white/50 text-center mt-4">
                By subscribing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          {/* FAQ or Trust Badges */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center space-x-6 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-success" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-success" />
                <span>Secure payment</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-success" />
                <span>Instant access</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default SubscribePage;
