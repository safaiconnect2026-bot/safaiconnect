// SafaiConnect – flat translation map
// Keys are used with the t(key) helper from LanguageContext

export type Locale = 'en' | 'ur' | 'sd';

export type TranslationKey =
    // Nav / Layout
    | 'app_name'
    | 'logout'
    | 'language'
    // Sidebar – Citizen
    | 'nav_dashboard'
    | 'nav_report_issue'
    | 'nav_book_collection'
    | 'nav_ondemand'
    | 'nav_training'
    // Sidebar – Admin
    | 'nav_overview'
    | 'nav_complaints'
    | 'nav_workers'
    | 'nav_verification'
    | 'nav_salary'
    // Sidebar – Superadmin
    | 'nav_admin_management'
    | 'nav_inventory'
    | 'nav_reports'
    | 'nav_settings'
    // Dashboard page
    | 'citizen_dashboard_title'
    | 'citizen_dashboard_subtitle'
    | 'stat_reports'
    | 'stat_resolved'
    | 'stat_points'
    | 'stat_training'
    | 'recent_reports'
    | 'garbage_collection'
    | 'next_collection'
    | 'last_collection'
    | 'tomorrow_8am'
    | 'yesterday_8am'
    | 'completed_successfully'
    | 'book_ondemand_btn'
    | 'area_score_title'
    | 'area_performing_well'
    | 'this_week'
    // Report issue page
    | 'report_title'
    | 'report_subtitle'
    | 'issue_type'
    | 'select_issue_type'
    | 'overflowing_bin'
    | 'missed_collection'
    | 'illegal_dumping'
    | 'damaged_bin'
    | 'other'
    | 'location'
    | 'location_placeholder'
    | 'description'
    | 'description_placeholder'
    | 'photo_evidence'
    | 'take_photo'
    | 'open_camera'
    | 'save_draft'
    | 'submit_report'
    | 'speak_description'
    | 'listening'
    // Book collection
    | 'book_title'
    | 'book_subtitle'
    | 'read_aloud'
    // General
    | 'coming_soon'
    | 'submit';

type Translations = Record<TranslationKey, string>;

export const translations: Record<Locale, Translations> = {
    en: {
        app_name: 'SafaiConnect',
        logout: 'Logout',
        language: 'Language',
        nav_dashboard: 'Dashboard',
        nav_report_issue: 'Report Issue',
        nav_book_collection: 'Book Collection',
        nav_ondemand: 'On-Demand Service',
        nav_training: 'Training',
        nav_overview: 'Overview',
        nav_complaints: 'Complaints',
        nav_workers: 'Workers',
        nav_verification: 'Work Verification',
        nav_salary: 'Salary Tracking',
        nav_admin_management: 'Admin Management',
        nav_inventory: 'Inventory',
        nav_reports: 'Reports',
        nav_settings: 'Settings',
        citizen_dashboard_title: 'Citizen Dashboard',
        citizen_dashboard_subtitle: 'Your waste management activities and community impact',
        stat_reports: 'Reports Submitted',
        stat_resolved: 'Issues Resolved',
        stat_points: 'Reward Points',
        stat_training: 'Training Progress',
        recent_reports: 'Recent Reports',
        garbage_collection: 'Garbage Collection',
        next_collection: 'Next Collection',
        last_collection: 'Last Collection',
        tomorrow_8am: 'Tomorrow at 8:00 AM',
        yesterday_8am: 'Yesterday at 8:15 AM',
        completed_successfully: 'Completed successfully',
        book_ondemand_btn: 'Book On-Demand Collection',
        area_score_title: 'Area Cleanliness Score',
        area_performing_well: 'Your neighborhood is performing well!',
        this_week: 'This Week',
        report_title: 'Report an Issue',
        report_subtitle: 'Help keep your community clean by reporting waste management issues',
        issue_type: 'Issue Type',
        select_issue_type: 'Select issue type',
        overflowing_bin: 'Overflowing Bin',
        missed_collection: 'Missed Collection',
        illegal_dumping: 'Illegal Dumping',
        damaged_bin: 'Damaged Bin',
        other: 'Other',
        location: 'Location',
        location_placeholder: 'Enter location or use current location',
        description: 'Description',
        description_placeholder: 'Describe the issue in detail',
        photo_evidence: 'Photo Evidence',
        take_photo: 'Take a photo of the issue',
        open_camera: 'Open Camera',
        save_draft: 'Save as Draft',
        submit_report: 'Submit Report',
        speak_description: 'Speak',
        listening: 'Listening…',
        book_title: 'Book Collection',
        book_subtitle: 'Request waste collection and track your booking history',
        read_aloud: 'Read Aloud',
        coming_soon: 'Feature Coming Soon',
        submit: 'Submit',
    },

    ur: {
        app_name: 'صفائی کنیکٹ',
        logout: 'لاگ آؤٹ',
        language: 'زبان',
        nav_dashboard: 'ڈیش بورڈ',
        nav_report_issue: 'مسئلہ رپورٹ کریں',
        nav_book_collection: 'کلیکشن بک کریں',
        nav_ondemand: 'آن ڈیمانڈ سروس',
        nav_training: 'تربیت',
        nav_overview: 'جائزہ',
        nav_complaints: 'شکایات',
        nav_workers: 'کارکنان',
        nav_verification: 'کام کی تصدیق',
        nav_salary: 'تنخواہ ٹریکنگ',
        nav_admin_management: 'ایڈمن مینجمنٹ',
        nav_inventory: 'انوینٹری',
        nav_reports: 'رپورٹس',
        nav_settings: 'ترتیبات',
        citizen_dashboard_title: 'شہری ڈیش بورڈ',
        citizen_dashboard_subtitle: 'آپ کی فضلہ انتظام سرگرمیاں اور کمیونٹی اثر',
        stat_reports: 'جمع کردہ رپورٹیں',
        stat_resolved: 'حل شدہ مسائل',
        stat_points: 'انعامی پوائنٹس',
        stat_training: 'تربیتی پیشرفت',
        recent_reports: 'حالیہ رپورٹیں',
        garbage_collection: 'کچرا اکٹھا کرنا',
        next_collection: 'اگلا اکٹھا',
        last_collection: 'آخری اکٹھا',
        tomorrow_8am: 'کل صبح 8:00 بجے',
        yesterday_8am: 'کل صبح 8:15 بجے',
        completed_successfully: 'کامیابی سے مکمل',
        book_ondemand_btn: 'آن ڈیمانڈ کلیکشن بک کریں',
        area_score_title: 'علاقے کی صفائی اسکور',
        area_performing_well: 'آپ کا محلہ اچھی کارکردگی دکھا رہا ہے!',
        this_week: 'اس ہفتے',
        report_title: 'مسئلہ رپورٹ کریں',
        report_subtitle: 'فضلہ انتظام کے مسائل رپورٹ کر کے اپنی کمیونٹی کو صاف رکھیں',
        issue_type: 'مسئلے کی قسم',
        select_issue_type: 'مسئلے کی قسم منتخب کریں',
        overflowing_bin: 'بھرا ہوا ڈبہ',
        missed_collection: 'چھوٹی ہوئی وصولی',
        illegal_dumping: 'غیرقانونی کوڑا پھینکنا',
        damaged_bin: 'خراب ڈبہ',
        other: 'دیگر',
        location: 'مقام',
        location_placeholder: 'مقام درج کریں یا موجودہ مقام استعمال کریں',
        description: 'تفصیل',
        description_placeholder: 'مسئلے کی تفصیل بتائیں',
        photo_evidence: 'تصویری ثبوت',
        take_photo: 'مسئلے کی تصویر لیں',
        open_camera: 'کیمرہ کھولیں',
        save_draft: 'مسودہ محفوظ کریں',
        submit_report: 'رپورٹ جمع کریں',
        speak_description: 'بولیں',
        listening: 'سن رہا ہے…',
        book_title: 'کلیکشن بک کریں',
        book_subtitle: 'فضلہ وصولی کی درخواست دیں اور بکنگ کی تاریخ دیکھیں',
        read_aloud: 'بلند آواز میں پڑھیں',
        coming_soon: 'یہ فیچر جلد آ رہا ہے',
        submit: 'جمع کریں',
    },

    sd: {
        app_name: 'صفائي ڪنيڪٽ',
        logout: 'لاگ آئوٽ',
        language: 'ٻولي',
        nav_dashboard: 'ڊيش بورڊ',
        nav_report_issue: 'مسئلو رپورٽ ڪريو',
        nav_book_collection: 'گڏ ڪرڻ بُڪ ڪريو',
        nav_ondemand: 'آن ڊيمانڊ سروس',
        nav_training: 'تربيت',
        nav_overview: 'جائزو',
        nav_complaints: 'شڪايتون',
        nav_workers: 'مزدور',
        nav_verification: 'ڪم جي تصديق',
        nav_salary: 'تنخواه ٽريڪنگ',
        nav_admin_management: 'ايڊمن مئنيجمينٽ',
        nav_inventory: 'انوينٽري',
        nav_reports: 'رپورٽون',
        nav_settings: 'سيٽنگ',
        citizen_dashboard_title: 'شهري ڊيش بورڊ',
        citizen_dashboard_subtitle: 'توهان جون فضلي انتظام سرگرمیون ۽ ڪميونٽي اثر',
        stat_reports: 'جمع ڪيل رپورٽون',
        stat_resolved: 'حل ٿيل مسئلا',
        stat_points: 'انعامي پوائينٽ',
        stat_training: 'تربيتي ترقي',
        recent_reports: 'تازيون رپورٽون',
        garbage_collection: 'ڪچري گڏ ڪرڻ',
        next_collection: 'ايندڙ گڏ ڪرڻ',
        last_collection: 'آخري گڏ ڪرڻ',
        tomorrow_8am: 'سڀاڻي صبح 8:00 وڳي',
        yesterday_8am: 'ڪالهه صبح 8:15 وڳي',
        completed_successfully: 'ڪاميابيءَ سان مڪمل',
        book_ondemand_btn: 'آن ڊيمانڊ گڏ ڪرڻ بُڪ ڪريو',
        area_score_title: 'علائقي صفائي اسڪور',
        area_performing_well: 'توهان جو محلو سٺي ڪارڪردگي ڏيکاري رهيو آهي!',
        this_week: 'هن هفتي',
        report_title: 'مسئلو رپورٽ ڪريو',
        report_subtitle: 'فضلي انتظام جا مسئلا رپورٽ ڪري ڪميونٽي صاف رکو',
        issue_type: 'مسئلي جو قسم',
        select_issue_type: 'مسئلي جو قسم چونڊيو',
        overflowing_bin: 'ڀريل ٻوري',
        missed_collection: 'کٽيل گڏ ڪرڻ',
        illegal_dumping: 'غيرقانوني ڪچرو اڇلائڻ',
        damaged_bin: 'خراب ٻوري',
        other: 'ٻيو',
        location: 'جڳهه',
        location_placeholder: 'جڳهه لکو يا موجوده جڳهه استعمال ڪريو',
        description: 'تفصيل',
        description_placeholder: 'مسئلي جي تفصيل ٻڌايو',
        photo_evidence: 'تصويري ثبوت',
        take_photo: 'مسئلي جي تصوير وٺو',
        open_camera: 'ڪئميرو کوليو',
        save_draft: 'مسودو محفوظ ڪريو',
        submit_report: 'رپورٽ جمع ڪريو',
        speak_description: 'ڳالهايو',
        listening: 'ٻڌي رهيو آهي…',
        book_title: 'گڏ ڪرڻ بُڪ ڪريو',
        book_subtitle: 'فضلي گڏ ڪرڻ جي درخواست ڪريو ۽ بکنگ تاريخ ڏسو',
        read_aloud: 'اونچو پڙهو',
        coming_soon: 'فيچر جلد اچي رهيو آهي',
        submit: 'جمع ڪريو',
    },
};
