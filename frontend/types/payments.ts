export interface PaymentRequest {
  customerId: string;
  amount: number;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  payment?: {
    id: string;
    customerId: string;
    amount: number;
    description: string | null;
    status: string;
  };
  message?: string;
}