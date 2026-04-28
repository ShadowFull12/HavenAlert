import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MODEL_NAME = 'gemini-3.1-flash-lite-preview';

function getModel() {
  if (!genAI) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env');
  }
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

/**
 * 1. Triage classification — called on SOS trigger
 * Input: guest's description of emergency
 * Output: { type, severity, briefing, recommendedActions }
 */
export async function triageIncident(description, guestLanguage = 'en') {
  try {
    const model = getModel();
    const prompt = `You are a crisis triage AI for a hospitality venue. A guest has reported an emergency.

Guest's description (language: ${guestLanguage}): "${description}"

Analyze this and respond in ONLY valid JSON (no markdown, no code fences):
{
  "type": one of ["medical", "fire", "security", "maintenance", "noise", "theft", "other"],
  "severity": one of ["low", "medium", "high", "critical"],
  "briefing": "A concise 2-3 sentence briefing for staff describing what happened and immediate priorities",
  "recommendedActions": ["action1", "action2", "action3"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini triage error:', error);
    return {
      type: 'other',
      severity: 'medium',
      briefing: 'AI triage unavailable. Manual assessment required.',
      recommendedActions: ['Assess situation manually', 'Contact guest directly']
    };
  }
}

/**
 * 2. Incident briefing — called when staff opens an incident
 * Input: incident object + guest medical profile
 * Output: 3-sentence briefing for staff
 */
export async function generateBriefing(incident, medicalProfile = {}) {
  try {
    const model = getModel();
    const medInfo = Object.keys(medicalProfile).length > 0
      ? `Guest medical info: ${JSON.stringify(medicalProfile)}`
      : 'No medical profile on file.';

    const prompt = `You are a crisis management AI. Generate a concise 3-sentence staff briefing for this incident.

Incident: ${JSON.stringify({ title: incident.title, description: incident.description, type: incident.type, severity: incident.severity, location: incident.location_text })}
${medInfo}

Respond with ONLY the briefing text (3 sentences, no JSON, no formatting). Focus on what happened, key risks, and recommended immediate action.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini briefing error:', error);
    return 'AI briefing unavailable. Please review incident details manually.';
  }
}

/**
 * 3. Translate message
 */
export async function translateMessage(text, from, to) {
  try {
    const model = getModel();
    const prompt = `Translate the following text from ${from} to ${to}. Respond with ONLY the translated text, nothing else.

Text: "${text}"`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini translation error:', error);
    return text;
  }
}

/**
 * 4. Full incident report
 */
export async function generateIncidentReport(incident, events, messages) {
  try {
    const model = getModel();
    const prompt = `You are a compliance officer generating a formal incident report. Create a detailed, professional incident report in markdown format.

Incident Details:
${JSON.stringify(incident, null, 2)}

Event Timeline:
${JSON.stringify(events, null, 2)}

Communication Log:
${JSON.stringify(messages.map(m => ({ time: m.created_at, sender: m.is_staff ? 'Staff' : 'Guest', message: m.message })), null, 2)}

Generate a formal incident report with these sections:
1. INCIDENT SUMMARY
2. TIMELINE OF EVENTS
3. COMMUNICATIONS LOG
4. ACTIONS TAKEN
5. RESOLUTION & OUTCOME
6. RECOMMENDATIONS

Use professional language suitable for compliance records.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini report error:', error);
    return '# Incident Report\n\nAI report generation failed. Please compile the report manually from the incident timeline and communications log.';
  }
}

/**
 * 5. Sentiment / distress analysis
 */
export async function analyzeDistress(text) {
  try {
    const model = getModel();
    const prompt = `Analyze the distress level of this message from a hotel/venue guest. Respond in ONLY valid JSON (no markdown, no code fences):

Message: "${text}"

{
  "distressLevel": one of ["low", "medium", "high", "critical"],
  "urgencySignals": ["signal1", "signal2"]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini distress analysis error:', error);
    return { distressLevel: 'medium', urgencySignals: ['Unable to analyze — treat as moderate urgency'] };
  }
}
