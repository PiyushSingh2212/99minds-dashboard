const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    // Identity
    firstName: String,
    lastName: String,
    fullName: { type: String, required: true },
    linkedinUrl: String,
    salesNavUrl: String,
    uniqueId: String,

    // Role
    currentJob: String,
    headline: String,
    summary: String,
    jobDescription: String,
    yearsInPosition: Number,
    monthsInPosition: Number,

    // Location
    location: String,
    city: String,
    state: String,
    country: String,

    // Network
    connections: Number,
    isOpenToWork: Boolean,
    isPremium: Boolean,
    profilePicture: String,

    // Company
    companyName: String,
    companyDomain: String,
    companyWebsite: String,
    companyLinkedin: String,
    companyIndustry: String,
    companySize: String,
    companyType: String,
    companyLocation: String,
    companyFounded: String,
    companyDescription: String,
    companySpecialities: String,
    companyLogo: String,

    // 99minds enrichment
    emailGuess: String,
    icpScore: { type: Number, min: 1, max: 10 },
    scoreReason: String,
    outreachAngle: String,
    platformGuess: String,
    industryTag: String,
    matchesIcp: { type: String, enum: ['YES', 'MAYBE', 'NO'] },

    // Meta
    importedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'chrome-extension' },
    contacted: { type: Boolean, default: false },
    notes: String,
  },
  { timestamps: true }
);

// Deduplicate on import by fullName + companyName
LeadSchema.index({ fullName: 1, companyName: 1 }, { unique: true });

module.exports = mongoose.model('Lead', LeadSchema);
