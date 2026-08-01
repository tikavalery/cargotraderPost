import { createModel, isValidId } from '../db/createModel.js';
import bcrypt from 'bcryptjs';

const User = createModel('User', {
  methods: {
    async matchPassword(plain) {
      if (!this.password) return false;
      return bcrypt.compare(plain, this.password);
    },
    toPublicJSON() {
      const preferredCurrency = this.preferredCurrency || this.preferredCurrencies?.[0] || 'XAF';
      return {
        id: String(this._id || this.id),
        name: this.name,
        email: this.email || '',
        phone: this.phone || '',
        role: this.role,
        countriesOperated: this.countriesOperated || [],
        preferredCurrency,
        preferredCurrencies: [preferredCurrency],
        currencies: [preferredCurrency],
        currency: preferredCurrency,
        country: this.countriesOperated?.[0] || 'Cameroon',
        businessName: '',
        defaultBusinessId: this.defaultBusinessId ? String(this.defaultBusinessId) : null,
        gracePeriodEnd: this.gracePeriodEnd || null,
        businesses: (this.businesses || []).map((b) => ({
          business: String(b.business),
          role: b.role
        }))
      };
    }
  }
});

export { isValidId };
export default User;
