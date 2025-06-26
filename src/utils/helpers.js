function parseNestedFields(flatObj) {
  const result = {};
  for (const key in flatObj) {
    const keys = key.replace(/\]/g, "").split("["); // 'address[city]' → ['address', 'city']
    keys.reduce((acc, part, index) => {
      if (index === keys.length - 1) {
        acc[part] = flatObj[key];
      } else {
        acc[part] = acc[part] || {};
      }
      return acc[part];
    }, result);
  }
  return result;
}

module.exports = { parseNestedFields };
