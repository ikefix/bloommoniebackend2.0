import paystack from 'paystack';
import crypto from 'crypto';

const paystackInstance = paystack(process.env.PAYSTACK_SECRET_KEY);

class PaystackService {
  // Initialize transaction
  static async initializeTransaction(email, amount, metadata = {}) {
    try {
      const response = await paystackInstance.transaction.initialize({
        email,
        amount: amount * 100, // Paystack expects amount in kobo (cents)
        currency: 'NGN',
        metadata: {
          ...metadata,
          custom_fields: [
            {
              display_name: "Wallet Funding",
              variable_name: "wallet_funding",
              value: "true"
            }
          ]
        },
        callback_url: process.env.PAYSTACK_CALLBACK_URL || `${process.env.APP_URL}/payment/success`
      });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to initialize transaction');
      }
    } catch (error) {
      console.error('Paystack initialization error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Verify transaction
  static async verifyTransaction(reference) {
    try {
      const response = await paystackInstance.transaction.verify(reference);

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to verify transaction');
      }
    } catch (error) {
      console.error('Paystack verification error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get transaction details
  static async getTransaction(reference) {
    try {
      const response = await paystackInstance.transaction.get(reference);

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to get transaction');
      }
    } catch (error) {
      console.error('Paystack get transaction error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Verify webhook signature
  static verifyWebhookSignature(payload, signature) {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      console.error('Paystack webhook secret not configured');
      return false;
    }

    const hash = crypto.createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }

  // Create customer
  static async createCustomer(email, firstName, lastName, phone) {
    try {
      const response = await paystackInstance.customer.create({
        email,
        first_name: firstName,
        last_name: lastName,
        phone
      });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Paystack create customer error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Initialize recurring billing
  static async initializeRecurring(email, plan, amount) {
    try {
      const response = await paystackInstance.transaction.initialize({
        email,
        amount: amount * 100,
        currency: 'NGN',
        plan,
        callback_url: process.env.PAYSTACK_CALLBACK_URL || `${process.env.APP_URL}/payment/success`
      });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to initialize recurring payment');
      }
    } catch (error) {
      console.error('Paystack recurring payment error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get banks list
  static async getBanks() {
    try {
      const response = await paystackInstance.miscellaneous.list_banks({ country: 'nigeria' });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to get banks list');
      }
    } catch (error) {
      console.error('Paystack get banks error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Resolve account number
  static async resolveAccount(accountNumber, bankCode) {
    try {
      const response = await paystackInstance.miscellaneous.resolve_account({
        account_number: accountNumber,
        bank_code: bankCode
      });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to resolve account');
      }
    } catch (error) {
      console.error('Paystack resolve account error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Create transfer recipient
  static async createTransferRecipient(type, name, accountNumber, bankCode) {
    try {
      const response = await paystackInstance.transfer_recipient.create({
        type,
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN'
      });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to create transfer recipient');
      }
    } catch (error) {
      console.error('Paystack create transfer recipient error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Initiate transfer
  static async initiateTransfer(recipientCode, amount, reason) {
    try {
      const response = await paystackInstance.transfer.create({
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: reason || 'Wallet withdrawal'
      });

      if (response.status) {
        return {
          success: true,
          data: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to initiate transfer');
      }
    } catch (error) {
      console.error('Paystack initiate transfer error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export default PaystackService;
