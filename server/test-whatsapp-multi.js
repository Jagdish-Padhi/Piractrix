import mongoose from 'mongoose';
import Organization from './src/models/organization.model.js';
import { sendWhatsAppAlert } from './src/services/whatsapp.service.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI;

const violations = [
  {
    _id: new mongoose.Types.ObjectId().toString(),
    platform: 'youtube',
    matchConfidence: 94,
    matchType: 'video_fingerprint',
    caseId: 'PIR-YT-' + Math.floor(Math.random()*10000)
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    platform: 'reddit',
    matchConfidence: 88,
    matchType: 'text_scan',
    caseId: 'PIR-RD-' + Math.floor(Math.random()*10000)
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    platform: 'vimeo',
    matchConfidence: 99,
    matchType: 'video_fingerprint',
    caseId: 'PIR-VM-' + Math.floor(Math.random()*10000)
  }
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const org = await Organization.findOne({ "notificationPrefs.whatsappNumber": { $ne: null, $ne: "" } });
    
    if (!org || !org.notificationPrefs.whatsappNumber) {
      console.log('No organization with a whatsappNumber found. Ensure you saved your number in the UI.');
      process.exit(1);
    }

    const number = org.notificationPrefs.whatsappNumber;
    console.log(`Sending 3 WhatsApp demo alerts to ${number}...`);

    for (const v of violations) {
      await sendWhatsAppAlert({
        to: number,
        org: org,
        violation: v,
        severity: 5
      });
      console.log(`✅ Sent WhatsApp alert for ${v.platform}`);
      // Sleep for 1.5 seconds between messages
      await new Promise(r => setTimeout(r, 1500));
    }
    
    console.log('🎉 All WhatsApp demo alerts dispatched successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to send WhatsApp alerts:', err);
    process.exit(1);
  }
}

run();
