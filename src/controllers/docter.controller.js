// src/controllers/doctor.controller.js

const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

/**
 * @desc Create doctor profile (admin use / seeding)
 * @route POST /api/doctors
 */
exports.createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      doctor,
    });
  } catch (error) {
    console.error("Error creating doctor:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * @desc Get doctor details by ID
 * @route GET /api/doctors/:id
 */
exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({ success: true, doctor });
  } catch (error) {
    console.error("Error fetching doctor:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * @desc Search doctors with filters (Doctor Discovery)
 * @route GET /api/doctors/search
 */
exports.searchDoctors = async (req, res) => {
  try {
    const {
      specialty,
      city,
      consultationType,
      supportsEmergency,
      lat,
      lng,
      radiusKm,
      date, // optional for availability filter
    } = req.query;

    const filters = {
      status: "active",
      isAcceptingNewPatients: true,
    };

    if (specialty) filters.specialties = specialty;
    if (city) filters["clinic.city"] = city;

    if (consultationType === "telemedicine") {
      filters["consultationModes.telemedicine"] = true;
    } else if (consultationType === "inClinic") {
      filters["consultationModes.inClinic"] = true;
    }

    if (supportsEmergency === "true") {
      filters.supportsEmergency = true;
    }

    if (lat && lng && radiusKm) {
      filters["clinic.location"] = {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: radiusKm * 1000, // meters
        },
      };
    }

    let doctors = await Doctor.find(filters).lean();

    // Filter using schedule if date provided
    if (date) {
      const dayIndex = new Date(date).getDay();
      doctors = doctors.filter((doc) => {
        const schedule = doc.scheduleTemplate?.find(
          (d) => d.dayOfWeek === dayIndex && d.isWorking
        );
        return !!schedule;
      });
    }

    return res.status(200).json({
      success: true,
      total: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("Error searching doctors:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * @desc Get available slots for selected doctor & date
 * @route GET /api/doctors/:id/slots?date=YYYY-MM-DD
 */
exports.getDoctorSlotsForDate = async (req, res) => {
  try {
    const { date } = req.query;
    const doctorId = req.params.id;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required as query parameter",
      });
    }

    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const dayIndex = new Date(date).getDay();
    const daySchedule = doctor.scheduleTemplate?.find(
      (d) => d.dayOfWeek === dayIndex && d.isWorking
    );

    if (!daySchedule) {
      return res.status(200).json({
        success: true,
        slots: [],
        message: "Doctor not available on selected date",
      });
    }

    // Generate full slot list based on template
    const generatedSlots = [];
    daySchedule.sessions.forEach((session) => {
      let start = session.startTime;
      const [h, m] = start.split(":").map(Number);
      let startMin = h * 60 + m;

      const [h2, m2] = session.endTime.split(":").map(Number);
      const endMin = h2 * 60 + m2;

      while (startMin < endMin) {
        const slotHour = Math.floor(startMin / 60)
          .toString()
          .padStart(2, "0");
        const slotMin = (startMin % 60).toString().padStart(2, "0");

        generatedSlots.push(`${slotHour}:${slotMin}`);
        startMin += session.slotDurationMinutes;
      }
    });

    // Fetch booked appointments for the day
    const bookedAppointments = await Appointment.find({
      doctorId,
      date,
      status: "booked",
    }).lean();

    const bookedTimes = bookedAppointments.map((a) => a.startTime);

    const slots = generatedSlots.map((slot) => ({
      time: slot,
      status: bookedTimes.includes(slot) ? "booked" : "available",
    }));

    return res.status(200).json({
      success: true,
      totalSlots: slots.length,
      slots,
    });
  } catch (error) {
    console.error("Error getting doctor slots:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
