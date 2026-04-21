import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, FlatList,
  TextInput, SafeAreaView, StatusBar
} from 'react-native';
import AppText from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

// Country data with flags, codes, and names
const COUNTRIES = [
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

export default function CountryPicker({ 
  selectedCountry, 
  onSelectCountry, 
  visible, 
  onClose 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredCountries = COUNTRIES.filter(country =>
    country.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.includes(searchQuery)
  );

  const renderCountryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        selectedCountry?.iso === item.iso && styles.selectedCountryItem
      ]}
      onPress={() => {
        onSelectCountry(item);
        onClose();
      }}
    >
      <AppText style={styles.flag}>{item.flag}</AppText>
      <View style={styles.countryInfo}>
        <AppText style={styles.countryName}>{item.country}</AppText>
        <AppText style={styles.countryCode}>{item.code}</AppText>
      </View>
      {selectedCountry?.iso === item.iso && (
        <Ionicons name="checkmark" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Select Country</AppText>
          <View style={styles.placeholder} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search countries..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Countries List */}
        <FlatList
          data={filteredCountries}
          renderItem={renderCountryItem}
          keyExtractor={(item) => item.iso}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    padding: 4,
  },
  list: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedCountryItem: {
    backgroundColor: colors.primary + '10',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  countryCode: {
    fontSize: 14,
    color: colors.muted,
  },
});