import NoteBox from "~/components/InAppOnboarding/Walkthrough/Analyst/Description/NoteBox";

const AddingWidgetsNote = () => {
  return (
    <>
      You can view all the widgets available by clicking on this button. Connect a
      backend or add your own declarations to make data widgets available.
      <NoteBox>
        <div>
          <strong>Widget</strong> — Component within a dashboard that displays specific
          data or functions, like charts, tables, notes, images, and more.
        </div>
        <img
          src="/assets/images/onboarding/single/02_search.png"
          className="w-full h-[182px] rounded mb-2"
          alt="Widget demonstration"
        />
      </NoteBox>
    </>
  );
};

export default AddingWidgetsNote;
