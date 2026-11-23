interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color: string };
  handler: (response: { razorpay_payment_id: string }) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  on: (event: string, handler: (response: { error: { description: string } }) => void) => void;
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export {};
