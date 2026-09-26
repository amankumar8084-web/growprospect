const { Country, State, City } = require('country-state-city');

const getCountries = (req, res) => {
  try {
    const countries = Country.getAllCountries().map(c => ({
      id: c.isoCode,
      name: c.name,
    }));
    res.json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch countries' });
  }
};

const getStates = (req, res) => {
  try {
    const { countryId } = req.query;
    if (!countryId) {
      return res.status(400).json({ success: false, message: 'countryId is required' });
    }
    const states = State.getStatesOfCountry(countryId).map(s => ({
      id: s.isoCode,
      name: s.name,
    }));
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch states' });
  }
};

const getCities = (req, res) => {
  try {
    const { countryId, stateId } = req.query;
    if (!countryId || !stateId) {
      return res.status(400).json({ success: false, message: 'countryId and stateId are required' });
    }
    const cities = City.getCitiesOfState(countryId, stateId).map(c => ({
      id: c.name,
      name: c.name,
    }));
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch cities' });
  }
};

module.exports = {
  getCountries,
  getStates,
  getCities
};
