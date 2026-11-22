import { searchProperties } from '../services/searchService.js';
import { getPropertyDetails } from '../services/propertyService.js';

export async function search(req, res) {
  const result = await searchProperties(req.validatedQuery);
  res.json(result);
}

export async function details(req, res) {
  const result = await getPropertyDetails(req.params.id, req.validatedQuery);
  res.json(result);
}
