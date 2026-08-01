import { canModifyStaff } from '../../utils/permissions';



export { canModifyStaff };



export default function StaffTableActions({ row, currentUser, onView, onEdit, onDelete }) {

  const editable = canModifyStaff(row, currentUser);



  return (

    <div className="settings-table-actions" onClick={(e) => e.stopPropagation()}>

      <button

        type="button"

        className="tbl-btn tbl-btn-view"

        onClick={() => onView(row)}

        aria-label="View"

        title="View"

      >

        <i className="fas fa-eye" />

      </button>

      <button

        type="button"

        className={`tbl-btn tbl-btn-edit${editable ? '' : ' is-disabled'}`}

        onClick={() => editable && onEdit(row)}

        aria-label="Edit"

        title={

          editable

            ? 'Edit'

            : row?.role === 'Business Owner'

              ? 'Cannot edit business owner'

              : 'Managers cannot edit their own record'

        }

      >

        <i className="fas fa-pen" />

      </button>

      <button

        type="button"

        className={`tbl-btn tbl-btn-delete${editable ? '' : ' is-disabled'}`}

        onClick={() => editable && onDelete(row)}

        aria-label="Delete"

        title={

          editable

            ? 'Remove'

            : row?.role === 'Business Owner'

              ? 'Cannot remove business owner'

              : 'Managers cannot remove their own record'

        }

      >

        <i className="fas fa-trash" />

      </button>

    </div>

  );

}


