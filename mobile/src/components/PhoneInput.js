import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput
} from 'react-native';
import AppText from './AppText';
import { Ionicons } from '@expo/vector-icons';
import CountryPicker from './CountryPicker';
import { colors, radius } from '../theme';

// Default country (Kenya as requested)
const DEFAULT_COUNTRY = {
  code: '+254',
  country: 'Kenya',
  flag: '🇰🇪',
  iso: 'KE'
};

export default function PhoneInput({
  value = '',
  onChangeText,
  placeholder = 'Phone number',
  error,
  style,
  disabled = false,
  autoFocus = false,
}) {
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    // Parse existing value if provided
    if (value && value.startsWith('+')) {
      const country = findCountryByPhone(value);
      if (country) {
        setSelectedCountry(country);
        setPhoneNumber(value.replace(country.code, ''));
      }
    }
  }, [value]);

  const findCountryByPhone = (phone) => {
    // Find country by matching the longest possible country code
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
    return sortedCountries.find(country => phone.startsWith(country.code));
  };

  const handlePhoneChange = (text) => {
    // Remove any non-digit characters except spaces and dashes for display
    const cleaned = text.replace(/[^\d\s-]/g, '');
    setPhoneNumber(cleaned);
    
    // Format the complete international number
    const fullNumber = selectedCountry.code + cleaned.replace(/[\s-]/g, '');
    onChangeText?.(fullNumber);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    // Update the full number with new country code
    const fullNumber = country.code + phoneNumber.replace(/[\s-]/g, '');
    onChangeText?.(fullNumber);
  };

  const formatPhoneDisplay = (phone) => {
    // Format phone number for display (add spaces for readability)
    if (!phone) return '';
    
    // Remove any existing formatting
    const digits = phone.replace(/\D/g, '');
    
    // Format based on length (basic formatting)
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.inputContainer,
        error && styles.inputError,
        disabled && styles.inputDisabled
      ]}>
        {/* Country Selector */}
        <TouchableOpacity
          style={styles.countrySelector}
          onPress={() => !disabled && setShowCountryPicker(true)}
          disabled={disabled}
        >
          <AppText style={styles.flag}>{selectedCountry.flag}</AppText>
          <AppText style={styles.countryCode}>{selectedCountry.code}</AppText>
          <Ionicons 
            name="chevron-down" 
            size={16} 
            color={disabled ? colors.muted : colors.text} 
          />
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.separator} />

        {/* Phone Input */}
        <TextInput
          style={styles.phoneInput}
          value={formatPhoneDisplay(phoneNumber)}
          onChangeText={handlePhoneChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoFocus={autoFocus}
          editable={!disabled}
          maxLength={15} // Reasonable limit for phone numbers
        />
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <AppText style={styles.errorText}>{error}</AppText>
        </View>
      )}

      {/* Country Picker Modal */}
      <CountryPicker
        visible={showCountryPicker}
        selectedCountry={selectedCountry}
        onSelectCountry={handleCountrySelect}
        onClose={() => setShowCountryPicker(false)}
      />
    </View>
  );
}

// Export the countries array for use in CountryPicker
export const COUNTRIES = [
  { code: '+93', country: 'Afghanistan', flag: '🇦🇫', iso: 'AF' },
  { code: '+355', country: 'Albania', flag: '🇦🇱', iso: 'AL' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿', iso: 'DZ' },
  { code: '+1', country: 'American Samoa', flag: '🇦🇸', iso: 'AS' },
  { code: '+376', country: 'Andorra', flag: '🇦🇩', iso: 'AD' },
  { code: '+244', country: 'Angola', flag: '🇦🇴', iso: 'AO' },
  { code: '+1', country: 'Antigua and Barbuda', flag: '🇦🇬', iso: 'AG' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷', iso: 'AR' },
  { code: '+374', country: 'Armenia', flag: '🇦🇲', iso: 'AM' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', iso: 'AU' },
  { code: '+43', country: 'Austria', flag: '🇦🇹', iso: 'AT' },
  { code: '+994', country: 'Azerbaijan', flag: '🇦🇿', iso: 'AZ' },
  { code: '+1', country: 'Bahamas', flag: '🇧🇸', iso: 'BS' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭', iso: 'BH' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', iso: 'BD' },
  { code: '+1', country: 'Barbados', flag: '🇧🇧', iso: 'BB' },
  { code: '+375', country: 'Belarus', flag: '🇧🇾', iso: 'BY' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪', iso: 'BE' },
  { code: '+501', country: 'Belize', flag: '🇧🇿', iso: 'BZ' },
  { code: '+229', country: 'Benin', flag: '🇧🇯', iso: 'BJ' },
  { code: '+975', country: 'Bhutan', flag: '🇧🇹', iso: 'BT' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴', iso: 'BO' },
  { code: '+387', country: 'Bosnia and Herzegovina', flag: '🇧🇦', iso: 'BA' },
  { code: '+267', country: 'Botswana', flag: '🇧🇼', iso: 'BW' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', iso: 'BR' },
  { code: '+673', country: 'Brunei', flag: '🇧🇳', iso: 'BN' },
  { code: '+359', country: 'Bulgaria', flag: '🇧🇬', iso: 'BG' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫', iso: 'BF' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮', iso: 'BI' },
  { code: '+855', country: 'Cambodia', flag: '🇰🇭', iso: 'KH' },
  { code: '+237', country: 'Cameroon', flag: '🇨🇲', iso: 'CM' },
  { code: '+1', country: 'Canada', flag: '🇨🇦', iso: 'CA' },
  { code: '+238', country: 'Cape Verde', flag: '🇨🇻', iso: 'CV' },
  { code: '+236', country: 'Central African Republic', flag: '🇨🇫', iso: 'CF' },
  { code: '+235', country: 'Chad', flag: '🇹🇩', iso: 'TD' },
  { code: '+56', country: 'Chile', flag: '🇨🇱', iso: 'CL' },
  { code: '+86', country: 'China', flag: '🇨🇳', iso: 'CN' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', iso: 'CO' },
  { code: '+269', country: 'Comoros', flag: '🇰🇲', iso: 'KM' },
  { code: '+242', country: 'Congo', flag: '🇨🇬', iso: 'CG' },
  { code: '+243', country: 'Congo (DRC)', flag: '🇨🇩', iso: 'CD' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷', iso: 'CR' },
  { code: '+225', country: 'Côte d\'Ivoire', flag: '🇨🇮', iso: 'CI' },
  { code: '+385', country: 'Croatia', flag: '🇭🇷', iso: 'HR' },
  { code: '+53', country: 'Cuba', flag: '🇨🇺', iso: 'CU' },
  { code: '+357', country: 'Cyprus', flag: '🇨🇾', iso: 'CY' },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿', iso: 'CZ' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰', iso: 'DK' },
  { code: '+253', country: 'Djibouti', flag: '🇩🇯', iso: 'DJ' },
  { code: '+1', country: 'Dominica', flag: '🇩🇲', iso: 'DM' },
  { code: '+1', country: 'Dominican Republic', flag: '🇩🇴', iso: 'DO' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨', iso: 'EC' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬', iso: 'EG' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻', iso: 'SV' },
  { code: '+240', country: 'Equatorial Guinea', flag: '🇬🇶', iso: 'GQ' },
  { code: '+291', country: 'Eritrea', flag: '🇪🇷', iso: 'ER' },
  { code: '+372', country: 'Estonia', flag: '🇪🇪', iso: 'EE' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹', iso: 'ET' },
  { code: '+679', country: 'Fiji', flag: '🇫🇯', iso: 'FJ' },
  { code: '+358', country: 'Finland', flag: '🇫🇮', iso: 'FI' },
  { code: '+33', country: 'France', flag: '🇫🇷', iso: 'FR' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦', iso: 'GA' },
  { code: '+220', country: 'Gambia', flag: '🇬🇲', iso: 'GM' },
  { code: '+995', country: 'Georgia', flag: '🇬🇪', iso: 'GE' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', iso: 'DE' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭', iso: 'GH' },
  { code: '+30', country: 'Greece', flag: '🇬🇷', iso: 'GR' },
  { code: '+1', country: 'Grenada', flag: '🇬🇩', iso: 'GD' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹', iso: 'GT' },
  { code: '+224', country: 'Guinea', flag: '🇬🇳', iso: 'GN' },
  { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼', iso: 'GW' },
  { code: '+592', country: 'Guyana', flag: '🇬🇾', iso: 'GY' },
  { code: '+509', country: 'Haiti', flag: '🇭🇹', iso: 'HT' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳', iso: 'HN' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺', iso: 'HU' },
  { code: '+354', country: 'Iceland', flag: '🇮🇸', iso: 'IS' },
  { code: '+91', country: 'India', flag: '🇮🇳', iso: 'IN' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩', iso: 'ID' },
  { code: '+98', country: 'Iran', flag: '🇮🇷', iso: 'IR' },
  { code: '+964', country: 'Iraq', flag: '🇮🇶', iso: 'IQ' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪', iso: 'IE' },
  { code: '+972', country: 'Israel', flag: '🇮🇱', iso: 'IL' },
  { code: '+39', country: 'Italy', flag: '🇮🇹', iso: 'IT' },
  { code: '+1', country: 'Jamaica', flag: '🇯🇲', iso: 'JM' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', iso: 'JP' },
  { code: '+962', country: 'Jordan', flag: '🇯🇴', iso: 'JO' },
  { code: '+7', country: 'Kazakhstan', flag: '🇰🇿', iso: 'KZ' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', iso: 'KE' },
  { code: '+686', country: 'Kiribati', flag: '🇰🇮', iso: 'KI' },
  { code: '+850', country: 'North Korea', flag: '🇰🇵', iso: 'KP' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', iso: 'KR' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼', iso: 'KW' },
  { code: '+996', country: 'Kyrgyzstan', flag: '🇰🇬', iso: 'KG' },
  { code: '+856', country: 'Laos', flag: '🇱🇦', iso: 'LA' },
  { code: '+371', country: 'Latvia', flag: '🇱🇻', iso: 'LV' },
  { code: '+961', country: 'Lebanon', flag: '🇱🇧', iso: 'LB' },
  { code: '+266', country: 'Lesotho', flag: '🇱🇸', iso: 'LS' },
  { code: '+231', country: 'Liberia', flag: '🇱🇷', iso: 'LR' },
  { code: '+218', country: 'Libya', flag: '🇱🇾', iso: 'LY' },
  { code: '+423', country: 'Liechtenstein', flag: '🇱🇮', iso: 'LI' },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹', iso: 'LT' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺', iso: 'LU' },
  { code: '+261', country: 'Madagascar', flag: '🇲🇬', iso: 'MG' },
  { code: '+265', country: 'Malawi', flag: '🇲🇼', iso: 'MW' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', iso: 'MY' },
  { code: '+960', country: 'Maldives', flag: '🇲🇻', iso: 'MV' },
  { code: '+223', country: 'Mali', flag: '🇲🇱', iso: 'ML' },
  { code: '+356', country: 'Malta', flag: '🇲🇹', iso: 'MT' },
  { code: '+692', country: 'Marshall Islands', flag: '🇲🇭', iso: 'MH' },
  { code: '+222', country: 'Mauritania', flag: '🇲🇷', iso: 'MR' },
  { code: '+230', country: 'Mauritius', flag: '🇲🇺', iso: 'MU' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽', iso: 'MX' },
  { code: '+691', country: 'Micronesia', flag: '🇫🇲', iso: 'FM' },
  { code: '+373', country: 'Moldova', flag: '🇲🇩', iso: 'MD' },
  { code: '+377', country: 'Monaco', flag: '🇲🇨', iso: 'MC' },
  { code: '+976', country: 'Mongolia', flag: '🇲🇳', iso: 'MN' },
  { code: '+382', country: 'Montenegro', flag: '🇲🇪', iso: 'ME' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦', iso: 'MA' },
  { code: '+258', country: 'Mozambique', flag: '🇲🇿', iso: 'MZ' },
  { code: '+95', country: 'Myanmar', flag: '🇲🇲', iso: 'MM' },
  { code: '+264', country: 'Namibia', flag: '🇳🇦', iso: 'NA' },
  { code: '+674', country: 'Nauru', flag: '🇳🇷', iso: 'NR' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', iso: 'NP' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱', iso: 'NL' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', iso: 'NZ' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮', iso: 'NI' },
  { code: '+227', country: 'Niger', flag: '🇳🇪', iso: 'NE' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', iso: 'NG' },
  { code: '+47', country: 'Norway', flag: '🇳🇴', iso: 'NO' },
  { code: '+968', country: 'Oman', flag: '🇴🇲', iso: 'OM' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', iso: 'PK' },
  { code: '+680', country: 'Palau', flag: '🇵🇼', iso: 'PW' },
  { code: '+507', country: 'Panama', flag: '🇵🇦', iso: 'PA' },
  { code: '+675', country: 'Papua New Guinea', flag: '🇵🇬', iso: 'PG' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾', iso: 'PY' },
  { code: '+51', country: 'Peru', flag: '🇵🇪', iso: 'PE' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', iso: 'PH' },
  { code: '+48', country: 'Poland', flag: '🇵🇱', iso: 'PL' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹', iso: 'PT' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', iso: 'QA' },
  { code: '+40', country: 'Romania', flag: '🇷🇴', iso: 'RO' },
  { code: '+7', country: 'Russia', flag: '🇷🇺', iso: 'RU' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼', iso: 'RW' },
  { code: '+1', country: 'Saint Kitts and Nevis', flag: '🇰🇳', iso: 'KN' },
  { code: '+1', country: 'Saint Lucia', flag: '🇱🇨', iso: 'LC' },
  { code: '+1', country: 'Saint Vincent and the Grenadines', flag: '🇻🇨', iso: 'VC' },
  { code: '+685', country: 'Samoa', flag: '🇼🇸', iso: 'WS' },
  { code: '+378', country: 'San Marino', flag: '🇸🇲', iso: 'SM' },
  { code: '+239', country: 'São Tomé and Príncipe', flag: '🇸🇹', iso: 'ST' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', iso: 'SA' },
  { code: '+221', country: 'Senegal', flag: '🇸🇳', iso: 'SN' },
  { code: '+381', country: 'Serbia', flag: '🇷🇸', iso: 'RS' },
  { code: '+248', country: 'Seychelles', flag: '🇸🇨', iso: 'SC' },
  { code: '+232', country: 'Sierra Leone', flag: '🇸🇱', iso: 'SL' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', iso: 'SG' },
  { code: '+421', country: 'Slovakia', flag: '🇸🇰', iso: 'SK' },
  { code: '+386', country: 'Slovenia', flag: '🇸🇮', iso: 'SI' },
  { code: '+677', country: 'Solomon Islands', flag: '🇸🇧', iso: 'SB' },
  { code: '+252', country: 'Somalia', flag: '🇸🇴', iso: 'SO' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', iso: 'ZA' },
  { code: '+211', country: 'South Sudan', flag: '🇸🇸', iso: 'SS' },
  { code: '+34', country: 'Spain', flag: '🇪🇸', iso: 'ES' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', iso: 'LK' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩', iso: 'SD' },
  { code: '+597', country: 'Suriname', flag: '🇸🇷', iso: 'SR' },
  { code: '+268', country: 'Swaziland', flag: '🇸🇿', iso: 'SZ' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪', iso: 'SE' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭', iso: 'CH' },
  { code: '+963', country: 'Syria', flag: '🇸🇾', iso: 'SY' },
  { code: '+886', country: 'Taiwan', flag: '🇹🇼', iso: 'TW' },
  { code: '+992', country: 'Tajikistan', flag: '🇹🇯', iso: 'TJ' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿', iso: 'TZ' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭', iso: 'TH' },
  { code: '+228', country: 'Togo', flag: '🇹🇬', iso: 'TG' },
  { code: '+676', country: 'Tonga', flag: '🇹🇴', iso: 'TO' },
  { code: '+1', country: 'Trinidad and Tobago', flag: '🇹🇹', iso: 'TT' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳', iso: 'TN' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', iso: 'TR' },
  { code: '+993', country: 'Turkmenistan', flag: '🇹🇲', iso: 'TM' },
  { code: '+688', country: 'Tuvalu', flag: '🇹🇻', iso: 'TV' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬', iso: 'UG' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦', iso: 'UA' },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪', iso: 'AE' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', iso: 'GB' },
  { code: '+1', country: 'United States', flag: '🇺🇸', iso: 'US' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾', iso: 'UY' },
  { code: '+998', country: 'Uzbekistan', flag: '🇺🇿', iso: 'UZ' },
  { code: '+678', country: 'Vanuatu', flag: '🇻🇺', iso: 'VU' },
  { code: '+39', country: 'Vatican City', flag: '🇻🇦', iso: 'VA' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪', iso: 'VE' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳', iso: 'VN' },
  { code: '+967', country: 'Yemen', flag: '🇾🇪', iso: 'YE' },
  { code: '+260', country: 'Zambia', flag: '🇿🇲', iso: 'ZM' },
  { code: '+263', country: 'Zimbabwe', flag: '🇿🇼', iso: 'ZW' },
].sort((a, b) => a.country.localeCompare(b.country));

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.muted + '20',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    minWidth: 40,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
});