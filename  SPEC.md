Codeyoung

Senior Full Stack Engineer – Technical Assignment

Objective: Build a usable appointment-booking web application that allows parents to book a trial class with
an available mentor while correctly handling time zones, Daylight Saving Time, mentor capacity, and booking
constraints.
1. Background & Problem Statement
At Codeyoung, parents can book a trial class to experience the product and the quality of coaching provided
by our mentors before signing up.
The typical customer journey is:
• The parent selects a convenient time slot.
• An available mentor is assigned to the trial class.
• Both the mentor and parent receive a class link for the live/demo session.
2. Assignment
Build a similar appointment-booking system for trial classes. The application should be a functional web app
that parents can use to select and book a trial class.
Resource Requirement
Mentors 10 mentors available for trial classes
Parents Approximately 20 parents interested in booking per day
Mentor capacity Maximum 2 demo/trial classes per mentor per day
3. Functional Requirements
Time Zones: Parents and mentors may be in different time zones. Parents are typically in the US or UK,
while mentors are in India. Local times must always be displayed and communicated to the relevant user.
Daylight Saving Time: The system must correctly handle Daylight Saving Time changes. Do not rely on
fixed UTC offsets for US/UK time zones.
Mentor Assignment: When a parent books a slot, the system should assign an available mentor who can
conduct the class at that time.
Demo Class Link: Generate/provide a dummy class link for the booking. It can be assumed that the link is
valid and leads to a demo class.
Daily Capacity: Each mentor can conduct a maximum of 2 demo classes per day.
No Availability: If no mentor is available for a requested slot, show a clear and customer-friendly error
state and guide the parent toward available alternatives.
4. Suggested User Experience
• Parent enters/selects their time zone or has it detected from the browser.

Codeyoung | Senior Full Stack Engineer Assignment | Page 2

• Parent selects a preferred date and time.
• The system shows available slots in the parent's local time.
• The system finds and assigns an eligible mentor.
• The booking is confirmed with the parent-facing local time, mentor details, and demo class link.
• The mentor receives the same booking information expressed in the mentor's local time.
• Unavailable slots should clearly explain that no mentor is available and offer alternative slots where
possible.
5. Technical Requirements
• Frontend: React.
• Backend: Node.js or Python for backend APIs.
• Libraries: You may use other appropriate frontend/backend libraries.
• Architecture: Structure the application using maintainable patterns and clear separation of concerns.
• Data: A lightweight database or suitable persistence layer may be used. Seed/demo data is acceptable.
• AI assistance: You are encouraged to use an AI assistant while solving the assignment.
6. Edge Cases to Consider
• Two parents attempting to book the same mentor/slot at nearly the same time.
• A mentor reaching the daily limit of 2 classes.
• A booking that crosses a time-zone boundary or daylight-saving transition.
• A parent selecting a slot for which all mentors are already booked.
• Different US time zones and the UK/Ireland DST rules.
• Avoiding ambiguous or misleading time displays; include the time-zone abbreviation or equivalent context
where useful.
7. Submission
• Submit the solution as a GitHub repository link.
• The repository must contain a README.md explaining how to install, configure, run, and test the
application.
• The repository must contain TRANSCRIPT.md with the full transcript of your AI-assisted development
sessions, including your prompts and the agent's responses.
• Include any seed data, environment-variable instructions, API documentation, or other setup details
required to run the application locally.
8. Evaluation Criteria
Area What will be evaluated
Product & UX Usability, clarity of the booking flow, customer experience, design sense, and quality of error/empty states.
Problem Solving How thoughtfully you handle capacity, availability, time zones, DST, concurrency, and edge cases.

Codeyoung | Senior Full Stack Engineer Assignment | Page 3

Area What will be evaluated
Architecture Code structure, separation of concerns, scalability, maintainability, and design patterns.
Engineering Quality Readability, correctness, validation, error handling, testing, and sensible use of dependencies.
AI Usage How effectively you guide the AI to produce good, maintainable code rather than relying on unstructured generation.
Research & Judgment How you investigate similar appointment-booking systems and decide what is appropriate to build without over-engineering.
Documentation Quality of README, setup instructions, assumptions, architecture notes, and AI transcript.
9. Candidate Guidance
There is no single prescribed implementation. You are expected to make sensible engineering and product
decisions. Prioritize a working, understandable, customer-friendly solution over unnecessary complexity.
Clearly document assumptions and trade-offs.

Good luck, and we look forward to seeing your approach!