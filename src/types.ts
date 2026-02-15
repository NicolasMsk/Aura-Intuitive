/* ═══════════════════════════════════════════════════════
   AURA INTUITIVE — Types
   ═══════════════════════════════════════════════════════ */

export interface Consultation {
  id: string;
  stripe_session_id: string;
  service: string;
  amount: number;
  status: 'paid' | 'submitted' | 'answered';
  customer_email: string | null;
  name: string | null;
  email: string | null;
  birthdate: string | null;
  person_concerned: string | null;
  message: string | null;
  response: string | null;
  submitted_at: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface SubmitBody {
  session_id: string;
  name: string;
  email: string;
  birthdate?: string | null;
  person_concerned?: string | null;
  message: string;
}

export interface RespondBody {
  id: string;
  response: string;
}

export interface LoginBody {
  password: string;
}
