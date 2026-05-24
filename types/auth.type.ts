export interface RegisterUserRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  termsAndConditionsAccepted: boolean;
}

export interface LoginUserRequest {
  email: string;
  password: string;
}

