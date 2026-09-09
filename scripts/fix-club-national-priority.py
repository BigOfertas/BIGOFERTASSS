from pathlib import Path

path = Path("scripts/catalog-business-rules.mjs")
value = path.read_text()
old = '''  const national = identifyNationalTeam(source, product);
  if (national) {
    const codes = inferNationalPatches(source, national);
    for (const code of explicit) codes.add(code);
    replaceCompetitionBadgeWithTitleholder(codes);
    return finalizePatches(codes);
  }

  const codes = inferDomesticClubPatches(source);
  for (const code of inferContinentalClubPatches(source)) codes.add(code);
  for (const code of inferSpecialClubPatches(source)) codes.add(code);
  for (const code of explicit) codes.add(code);
  replaceCompetitionBadgeWithTitleholder(codes);
  return finalizePatches(codes);'''
new = '''  const clubCodes = inferDomesticClubPatches(source);
  if (clubCodes.size > 0) {
    for (const code of inferContinentalClubPatches(source)) clubCodes.add(code);
    for (const code of inferSpecialClubPatches(source)) clubCodes.add(code);
    for (const code of explicit) clubCodes.add(code);
    replaceCompetitionBadgeWithTitleholder(clubCodes);
    return finalizePatches(clubCodes);
  }

  const national = identifyNationalTeam(source, product);
  if (national) {
    const codes = inferNationalPatches(source, national);
    for (const code of explicit) codes.add(code);
    replaceCompetitionBadgeWithTitleholder(codes);
    return finalizePatches(codes);
  }

  const codes = inferContinentalClubPatches(source);
  for (const code of inferSpecialClubPatches(source)) codes.add(code);
  for (const code of explicit) codes.add(code);
  replaceCompetitionBadgeWithTitleholder(codes);
  return finalizePatches(codes);'''
if old not in value:
    raise SystemExit("inferPurchasePatches priority fragment not found")
path.write_text(value.replace(old, new, 1))
print("CLUB_NATIONAL_PRIORITY_FIXED")
