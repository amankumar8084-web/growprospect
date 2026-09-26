import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';

export default function LocationSelector() {
  const { getToken } = useAuth();
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchWithToken = async (endpoint) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  };

  useEffect(() => {
    fetchWithToken('/api/locations/countries')
      .then(res => {
        if (res.success) setCountries(res.data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      setStates([]);
      setSelectedState('');
      return;
    }
    fetchWithToken(`/api/locations/states?countryId=${selectedCountry}`)
      .then(res => {
        if (res.success) setStates(res.data);
      })
      .catch(console.error);
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCountry || !selectedState) {
      setCities([]);
      setSelectedCity('');
      return;
    }
    fetchWithToken(`/api/locations/cities?countryId=${selectedCountry}&stateId=${selectedState}`)
      .then(res => {
        if (res.success) setCities(res.data);
      })
      .catch(console.error);
  }, [selectedCountry, selectedState]);

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
        <option value="">Select Country</option>
        {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select value={selectedState} onChange={e => setSelectedState(e.target.value)} disabled={!selectedCountry || states.length === 0}>
        <option value="">Select State</option>
        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} disabled={!selectedState || cities.length === 0}>
        <option value="">Select City</option>
        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}
